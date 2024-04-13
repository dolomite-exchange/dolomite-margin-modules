import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { createDepositAction } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  setEtherBalance,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  IGmxRegistryV1,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  PendleYtGLPPriceOracle,
} from '../../src/types';
import {
  createPendleGLPRegistry,
  createPendleYtGLP2024IsolationModeTokenVaultV1,
  createPendleYtGLP2024IsolationModeUnwrapperTraderV2,
  createPendleYtGLP2024IsolationModeVaultFactory,
  createPendleYtGLP2024IsolationModeWrapperTraderV2,
  createPendleYtGLPPriceOracle,
} from '../pendle-ecosystem-utils';
import { encodeSwapExactTokensForYt } from '../pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const FIVE_BIPS = 0.0005;

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtGLP2024IsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IPendleYtToken;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtGLP2024IsolationModeWrapperTraderV2;
  let factory: PendleYtGLP2024IsolationModeVaultFactory;
  let vault: PendleYtGLP2024IsolationModeTokenVaultV1;
  let priceOracle: PendleYtGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.glpMar2024.ytGlpToken.connect(core.hhUser1);

    const userVaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendleYtGLP2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
      core.pendleEcosystem!.glpMar2024.ytGlpToken,
      userVaultImplementation,
    );

    unwrapper = await createPendleYtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendleYtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendleYtGLPPriceOracle(core, factory, pendleRegistry);
    await disableInterestAccrual(core, core.marketIds.usdc);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendleYtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendleYtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usableUsdcAmount, 0, 0);
    const glpAmount = amountWei.mul(2);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.pendleEcosystem!.pendleRouter.address, glpAmount);

    await router.swapExactTokenForYt(
      core.pendleEcosystem!.glpMar2024.ptGlpMarket.address as any,
      core.gmxEcosystem!.sGlp.address as any,
      glpAmount,
      FIVE_BIPS,
    );
    await core.pendleEcosystem!.glpMar2024.ytGlpToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    await setupNewGenericTraderProxy(core, underlyingMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const glpAmount = await core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1!.connect(core.hhUser5)
        .getExchangeCost(
          core.tokens.usdc.address,
          core.tokens.dfsGlp!.address,
          usableUsdcAmount,
          BYTES_EMPTY,
        );

      const { extraOrderData, approxParams } = await encodeSwapExactTokensForYt(
        router,
        glpAmount,
        0,
        core.pendleEcosystem.glpMar2024.ptGlpMarket.address,
        core.gmxEcosystem.sGlp.address,
      );

      const vaultImpersonater = await impersonate(vault.address);
      await setEtherBalance(vault.address, ethers.utils.parseEther('1'));
      await setupUSDCBalance(core, vaultImpersonater, usableUsdcAmount, core.gmxEcosystem!.glpManager);
      await core.tokens.usdc.connect(vaultImpersonater)
        .approve(core.dolomiteMargin.address, ethers.constants.MaxUint256);

      // Insert deposit action so there is enough collateral
      const actions = [
        createDepositAction(
          usableUsdcAmount,
          core.marketIds.usdc,
          vaultImpersonater,
          vaultImpersonater.address,
        ),
        (
          await wrapper.createActionsForWrapping({
            primaryAccountId: solidAccountId,
            otherAccountId: liquidAccountId,
            primaryAccountOwner: ZERO_ADDRESS,
            primaryAccountNumber: defaultAccountNumber,
            otherAccountOwner: ZERO_ADDRESS,
            otherAccountNumber: defaultAccountNumber,
            outputMarket: underlyingMarketId,
            inputMarket: core.marketIds.usdc,
            minOutputAmount: ZERO_BI,
            inputAmount: usableUsdcAmount,
            orderData: extraOrderData,
          })
        )[0],
      ];

      await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions);

      const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.value).to.eq(0);

      await expectWalletBalance(wrapper.address, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(wrapper.address, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(wrapper.address, core.pendleEcosystem!.glpMar2024.ptGlpToken, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper
          .connect(core.hhUser1)
          .exchange(
            vault.address,
            core.dolomiteMargin.address,
            factory.address,
            core.tokens.usdc.address,
            usableUsdcAmount,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if trade originator is not a vault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          OTHER_ADDRESS,
          usableUsdcAmount,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `IsolationModeWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not whitelisted', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          OTHER_ADDRESS,
          usableUsdcAmount,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.usdc.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          ZERO_BI,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#pendleVaultRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
    });
  });

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, amountWei, BYTES_EMPTY),
        'PendleYtGLP2024WrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});

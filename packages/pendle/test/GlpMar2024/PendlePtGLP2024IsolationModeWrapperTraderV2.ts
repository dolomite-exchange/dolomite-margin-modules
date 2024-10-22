import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
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
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IGmxRegistryV1,
  IPendlePtToken,
  PendleGLPRegistry,
  PendlePtGLPMar2024IsolationModeTokenVaultV1,
  PendlePtGLPMar2024IsolationModeTokenVaultV1__factory,
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PendlePtGLPMar2024IsolationModeWrapperTraderV2,
  PendlePtGLPPriceOracle,
} from '../../src/types';
import {
  createPendleGLPRegistry,
  createPendlePtGLPMar2024IsolationModeTokenVaultV1,
  createPendlePtGLPMar2024IsolationModeVaultFactory,
  createPendlePtGLPMar2024IsolationModeWrapperTraderV2,
  createPendlePtGLPPriceOracle,
} from '../pendle-ecosystem-utils';
import { encodeSwapExactTokensForPt, ONE_TENTH_OF_ONE_BIPS_NUMBER } from '../pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // 200 units of underlying
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const FIVE_BIPS = 0.0005;

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtGLPMar2024IsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IPendlePtToken;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let pendleRegistry: PendleGLPRegistry;
  let wrapper: PendlePtGLPMar2024IsolationModeWrapperTraderV2;
  let factory: PendlePtGLPMar2024IsolationModeVaultFactory;
  let vault: PendlePtGLPMar2024IsolationModeTokenVaultV1;
  let priceOracle: PendlePtGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1);

    const userVaultImplementation = await createPendlePtGLPMar2024IsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendlePtGLPMar2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );

    wrapper = await createPendlePtGLPMar2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendlePtGLPPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLPMar2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtGLPMar2024IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const usdcAmount = amountWei.div(1e12).mul(8);
    const usableUsdcAmount = usdcAmount.div(2);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usableUsdcAmount, 0, 0);
    const glpAmount = amountWei.mul(2);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.pendleEcosystem!.pendleRouter.address, glpAmount);

    await router.swapExactTokenForPt(
      core.pendleEcosystem!.glpMar2024.glpMarket.address as any,
      core.gmxEcosystem!.sGlp.address as any,
      glpAmount,
      FIVE_BIPS,
    );
    await core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1).approve(vault.address, amountWei);
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

      const { extraOrderData, approxParams } = await encodeSwapExactTokensForPt(
        router,
        glpAmount,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        core.pendleEcosystem!.glpMar2024.glpMarket.address,
        core.gmxEcosystem.sGlp.address,
      );

      const actions = await wrapper.createActionsForWrapping({
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
      });

      await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableUsdcAmount);

      await expectWalletBalance(wrapper.address, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(wrapper.address, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(wrapper.address, core.pendleEcosystem!.glpMar2024.ptGlpToken, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
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
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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
          encodeExternalSellActionDataWithNoData(otherAmountWei),
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
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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
        'PendlePtGLPMar2024WrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});

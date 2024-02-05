import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { IGmxRegistryV1 } from '@dolomite-exchange/modules-glp/src/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IPendlePtToken,
  PendleGLPRegistry,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLPPriceOracle,
} from '../../src/types';
import {
  createPendleGLPRegistry,
  createPendlePtGLP2024IsolationModeTokenVaultV1,
  createPendlePtGLP2024IsolationModeUnwrapperTraderV2,
  createPendlePtGLP2024IsolationModeVaultFactory,
  createPendlePtGLP2024IsolationModeWrapperTraderV2,
  createPendlePtGLPPriceOracle,
} from '../pendle-ecosystem-utils';
import { encodeSwapExactPtForTokens, ONE_TENTH_OF_ONE_BIPS_NUMBER } from '../pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('PendlePtGLP2024IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IPendlePtToken;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendlePtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtGLP2024IsolationModeWrapperTraderV2;
  let factory: PendlePtGLP2024IsolationModeVaultFactory;
  let vault: PendlePtGLP2024IsolationModeTokenVaultV1;
  let priceOracle: PendlePtGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.glpMar2024.ptGlpToken;
    const userVaultImplementation = await createPendlePtGLP2024IsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendlePtGLP2024IsolationModeVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendlePtGLPPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const usdcAmount = amountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    const glpAmount = amountWei.mul(4);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.pendleEcosystem!.pendleRouter.address, glpAmount);

    await router.swapExactTokenForPt(
      core.pendleEcosystem!.glpMar2024.ptGlpMarket.address as any,
      core.gmxEcosystem!.sGlp.address as any,
      glpAmount,
      ONE_TENTH_OF_ONE_BIPS_NUMBER,
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

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { tokenOutput, extraOrderData } = await encodeSwapExactPtForTokens(
        router,
        amountWei,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        core.pendleEcosystem.glpMar2024.ptGlpMarket.address,
        core.gmxEcosystem.sGlp.address,
      );
      const amountOut = await core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1!.connect(core.hhUser5)
        .getExchangeCost(
          core.tokens.dfsGlp!.address,
          core.tokens.usdc.address,
          tokenOutput.minTokenOut,
          BYTES_EMPTY,
        );

      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.usdc,
        inputMarket: underlyingMarketId,
        minOutputAmount: amountOut,
        inputAmount: amountWei,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gt(amountOut);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.dfsGlp!.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.pendleEcosystem!.glpMar2024.ptGlpToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await unwrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#pendleRegistry', () => {
    it('should work', async () => {
      expect(await unwrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, BYTES_EMPTY),
        'PendlePtGLP2024UnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});

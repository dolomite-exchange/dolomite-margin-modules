import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  IERC20,
  IPendlePtMarket,
  IPendlePtToken,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtPriceOracle,
  PendleRegistry,
} from '../../../../src/types';
import { AccountInfoStruct } from '../../../../packages/base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../../packages/base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../../../../packages/base/test/utils';
import { expectThrow } from '../../../../packages/base/test/utils/assertions';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV2,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV2,
  createPendlePtPriceOracle,
  createPendleRegistry,
} from '@dolomite-exchange/modules-pendle/test/pendle';
import {
  CoreProtocol, getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWstETHBalance,
} from '../../../../packages/base/test/utils/setup';
import { encodeSwapExactPtForTokens, ONE_TENTH_OF_ONE_BIPS_NUMBER } from '../pendle-utils';
import { setupNewGenericTraderProxy } from '../../../../packages/base/test/utils/dolomite';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('20000000000000000000'); // 20
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('PendlePtWstEthJun2025IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtIsolationModeWrapperTraderV2;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumber;
  let vault: PendlePtIsolationModeTokenVaultV1;
  let priceOracle: PendlePtPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;
  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    ptMarket = core.pendleEcosystem!.wstEthJun2025.ptWstEthMarket.connect(core.hhUser1);
    ptToken = core.pendleEcosystem!.wstEthJun2025.ptWstEthToken.connect(core.hhUser1);
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.wstEthJun2025.ptWstEthMarket,
      core.pendleEcosystem!.wstEthJun2025.ptOracle,
      core.pendleEcosystem!.syWstEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      ptToken,
      userVaultImplementation,
    );
    underlyingToken = core.tokens.wstEth!;
    underlyingMarketId = BigNumber.from(core.marketIds.wstEth!);
    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const amount = parseEther('40');
    await setupWstETHBalance(core, core.hhUser1, amount, core.pendleEcosystem!.pendleRouter);

    // swapExactTokenForPt
    await router.swapExactTokenForPt(
      ptMarket.address as any,
      underlyingToken.address as any,
      amount,
      ONE_TENTH_OF_ONE_BIPS_NUMBER,
    );
    await ptToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await ptToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.eq(amountWei);

    await setupNewGenericTraderProxy(core, marketId);

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
        core,
        amountWei,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        ptMarket.address,
        underlyingToken.address,
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: underlyingMarketId,
        inputMarket: marketId,
        minOutputAmount: tokenOutput.minTokenOut,
        inputAmount: amountWei,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gt(tokenOutput.minTokenOut);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          underlyingToken.address,
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
          underlyingToken.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await ptToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await ptToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          underlyingToken.address,
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

  describe('#UNDERLYING_TOKEN', () => {
    it('should work', async () => {
      expect(await unwrapper.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
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
        unwrapper.getExchangeCost(factory.address, underlyingToken.address, amountWei, BYTES_EMPTY),
        'PendlePtUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});

import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWeEthBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  CoreProtocolArbitrumOne,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  IERC20,
  IPendlePtMarket,
  IPendlePtToken,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV3,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeWrapperTraderV3,
  PendlePtPriceOracleV2,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV3,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV3,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { encodeSwapExactPtForTokensV3, encodeSwapExactTokensForPtV3 } from '../pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('20000000000000000000'); // 20
const otherAmountWei = BigNumber.from('10000000'); // $10

// May have to adjust chainId in hardhat config to match arbitrum on hardhat network. Signatures will fail otherwise
describe('PendlePtEEthDec2024IsolationModeUnwrapperTraderV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV3;
  let wrapper: PendlePtIsolationModeWrapperTraderV3;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumber;
  let vault: PendlePtIsolationModeTokenVaultV1;
  let priceOracle: PendlePtPriceOracleV2;
  let defaultAccount: AccountInfoStruct;
  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;
  let ptBal: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    ptMarket = core.pendleEcosystem!.weEthDec2024.weEthMarket.connect(core.hhUser1);
    ptToken = core.pendleEcosystem!.weEthDec2024.ptWeEthToken.connect(core.hhUser1);
    underlyingToken = core.tokens.weEth!;

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthDec2024.weEthMarket,
      core.pendleEcosystem!.weEthDec2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      ptToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV3(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV3(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);

    const tokenInfo = {
      oracleInfos: [
        { oracle: priceOracle.address, tokenPair: underlyingToken.address, weight: 100 },
      ],
      decimals: 18,
      token: factory.address,
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, core.oracleAggregatorV2);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupWeEthBalance(core, core.hhUser1, amountWei, core.pendleEcosystem!.pendleRouterV3);
    const { tokenInput, approxParams, limitOrderData } = await encodeSwapExactTokensForPtV3(
      Network.ArbitrumOne,
      core.hhUser1.address,
      ptMarket.address,
      underlyingToken.address,
      amountWei,
      '0.002',
    );
    await core.pendleEcosystem.pendleRouterV3.swapExactTokenForPt(
      core.hhUser1.address, // reciever
      ptMarket.address, // ptMarket
      ONE_BI, // minPtOut
      approxParams, // ApproxParams
      tokenInput, // TokenInput
      limitOrderData, // LimitOrderData
    );

    ptBal = await ptToken.balanceOf(core.hhUser1.address);
    await ptToken.connect(core.hhUser1).approve(vault.address, ptBal);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ptBal);

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

      const { minOutputAmount, extraOrderData } = await encodeSwapExactPtForTokensV3(
        Network.ArbitrumOne,
        unwrapper.address,
        ptBal,
        ptMarket.address,
        underlyingToken.address,
        '0.002',
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        minOutputAmount,
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.weEth,
        inputMarket: marketId,
        inputAmount: ptBal,
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

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weEth);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gt(minOutputAmount);
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
          ptBal,
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
          ptBal,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          ptBal,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
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
        'PendlePtUnwrapperV3: getExchangeCost is not implemented',
      );
    });
  });
});

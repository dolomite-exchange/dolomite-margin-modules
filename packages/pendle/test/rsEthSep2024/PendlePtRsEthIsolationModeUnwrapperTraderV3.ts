import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
  setupRsEthBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BaseRouter } from '@pendle/sdk-v2';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
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
import { TokenInfo } from 'packages/oracles/src';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('20000000000000000000'); // 20
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('PendlePtRsEthSep2024IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
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

    ptMarket = core.pendleEcosystem!.rsEthSep2024.rsEthMarket.connect(core.hhUser1);
    ptToken = core.pendleEcosystem!.rsEthSep2024.ptRsEthToken.connect(core.hhUser1);
    underlyingToken = core.tokens.rsEth!;

    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      underlyingToken.address,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][underlyingToken.address]!.aggregatorAddress,
      false
    );
    let tokenInfo: TokenInfo = {
      oracleInfos: [
        { oracle: core.chainlinkPriceOracleV3.address, tokenPair: core.tokens.weth.address, weight: 100 }
      ],
      decimals: 18,
      token: underlyingToken.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, core.tokens.rsEth, false, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      underlyingMarketId,
      core.oracleAggregatorV2.address
    );

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthSep2024.rsEthMarket,
      core.pendleEcosystem!.rsEthSep2024.ptOracle,
      core.pendleEcosystem!.syREthToken,
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

    tokenInfo = {
      oracleInfos: [
        { oracle: priceOracle.address, tokenPair: underlyingToken.address, weight: 100 }
      ],
      decimals: 18,
      token: factory.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, core.oracleAggregatorV2);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupRsEthBalance(core, core.hhUser1, amountWei, core.pendleEcosystem!.pendleRouterV3);
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

    ptBal = await core.pendleEcosystem.rsEthSep2024.ptRsEthToken.balanceOf(core.hhUser1.address);
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
        '0.002'
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        minOutputAmount,
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: underlyingMarketId,
        inputMarket: marketId,
        inputAmount: ptBal,
        orderData: extraOrderData
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
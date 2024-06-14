import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  setupCoreProtocol,
  setupRsEthBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
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
import { encodeSwapExactTokensForPtV3 } from '../pendle-utils';
import { TokenInfo } from 'packages/oracles/src';

const defaultAccountNumber = '0';
const amountWei = parseEther('20'); // 20
const otherAmountWei = BigNumber.from('10000000'); // $10
const rsEthAmount = parseEther('500');
const usableAmount = parseEther('1');

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtRsEthSep2024IsolationModeWrapperTraderV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;
  let marketId: BigNumber;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumberish;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV3;
  let wrapper: PendlePtIsolationModeWrapperTraderV3;
  let factory: PendlePtIsolationModeVaultFactory;
  let vault: PendlePtIsolationModeTokenVaultV1;
  let priceOracle: PendlePtPriceOracleV2;
  let defaultAccount: AccountInfoStruct;
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
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
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

    await setupRsEthBalance(core, core.hhUser1, amountWei, core.pendleEcosystem.pendleRouterV3);
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

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { extraOrderData, approxParams } = await encodeSwapExactTokensForPtV3(
        Network.ArbitrumOne,
        wrapper.address,
        ptMarket.address,
        underlyingToken.address,
        usableAmount,
        '0.002'
      );

      const actions = await wrapper.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: ZERO_ADDRESS,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: ZERO_ADDRESS,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: marketId,
        inputMarket: underlyingMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: usableAmount,
        orderData: extraOrderData,
      });

      await setupRsEthBalance(core, core.hhUser1, parseEther('10'), core.pendleEcosystem!.pendleRouterV3);
      await underlyingToken.connect(core.hhUser1).transfer(core.dolomiteMargin.address, parseEther('10'));
      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.gte(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.gte(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableAmount);

      await expectWalletBalance(wrapper.address, ptToken, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          ptToken.address,
          usableAmount,
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
          ptToken.address,
          usableAmount,
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
          usableAmount,
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
          OTHER_ADDRESS,
          underlyingToken.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          underlyingToken.address,
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

  describe('#UNDERLYING_TOKEN', () => {
    it('should work', async () => {
      expect(await wrapper.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(underlyingToken.address, factory.address, amountWei, BYTES_EMPTY),
        'PendlePtWrapperV3: getExchangeCost is not implemented',
      );
    });
  });
});

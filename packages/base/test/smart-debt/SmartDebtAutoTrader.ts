import { expect } from 'chai';
import {
  GenericTraderProxyV2,
  TestSmartDebtAutoTrader
} from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { getBlockTimestamp, getLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupLINKBalance,
  setupUSDCBalance,
  setupUSDTBalance,
  setupWETHBalance
} from '../utils/setup';
import { createAndUpgradeDolomiteRegistry, createGenericTraderProxyV2, createTestSmartDebtAutoTrader } from '../utils/dolomite';
import { BigNumber } from 'ethers';
import { ActionType, BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { PairType } from '../utils/trader-utils';
import { getTestPayloads } from '@dolomite-exchange/modules-oracles/src/chainlink-data-streams';
import {
  TestVerifierProxy,
  TestVerifierProxy__factory
} from 'packages/oracles/src/types';
import { CHAINLINK_DATA_STREAM_FEEDS_MAP } from 'packages/base/src/utils/constants';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

const usdcAmount = BigNumber.from('100000000'); // $100
const usdtAmount = BigNumber.from('200000000');
const defaultAccountNumber = 0;
const borrowAccountNumber = BigNumber.from('123');

const USDC_USDT_PAIR_BYTES = '0x89832631fb3c3307a103ba2c84ab569c64d6182a18893dcd163f0f1c2090733a';

const futureTimestamp = 1850000000;

enum VolatilityLevel {
  NORMAL,
  SLIGHT,
  DEPEG
}

const depegFeePercentage = parseEther('0.1');
const slightFeePercentage = parseEther('0.05');

const depegReport = {
  timestamp: 0,
  bid: parseEther('0.95'),
  ask: parseEther('1.05'),
  benchmarkPrice: parseEther('1')
};
const slightReport = {
  timestamp: 0,
  bid: parseEther('0.97'),
  ask: parseEther('1.02'),
  benchmarkPrice: parseEther('1')
};
const normalReport = {
  timestamp: 0,
  bid: parseEther('0.99'),
  ask: parseEther('1.01'),
  benchmarkPrice: parseEther('1')
};

const feeSettings = {
  feeOverride: { value: ZERO_BI },
  depegThreshold: { value: parseEther('0.1') },
  slightThreshold: { value: parseEther('0.05') },
  feeCliffSeconds: 100,
  feeCompoundingInterval: 25
};

const pairPosition = {
  pairBytes: USDC_USDT_PAIR_BYTES,
  pairType: PairType.SMART_DEBT,
  minExchangeRate: ZERO_BI,
  maxExchangeRate: ZERO_BI
};

const price = ONE_ETH_BI;

describe('SmartDebtAutoTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestSmartDebtAutoTrader;

  let genericTraderProxy: GenericTraderProxyV2;
  let verifierProxy: TestVerifierProxy;

  let dolomiteImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 323_903_800,
    });
    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(
      core.borrowPositionProxyV2.address
    );
    verifierProxy = await createContractWithAbi<TestVerifierProxy>(
      TestVerifierProxy__factory.abi,
      TestVerifierProxy__factory.bytecode,
      []
    );
    trader = await createTestSmartDebtAutoTrader(
      core,
      verifierProxy,
      [core.tokens.usdc, core.tokens.usdt],
      [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']]
    );

    genericTraderProxy = await createGenericTraderProxyV2(core, Network.ArbitrumOne);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(trader.address, true);
    await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTraders(
      [trader.address],
      [true]
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTradeCallers(
      [genericTraderProxy.address],
      [true]
    );
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.usdt);

    await trader.connect(core.governance).ownerSetGlobalFee({ value: parseEther('.1') });
    await trader.connect(core.governance).ownerSetAdminFee({ value: parseEther('.5') });

    await setupLINKBalance(core, core.governance, parseEther('100'), trader);
    await core.tokens.link.connect(core.governance).transfer(trader.address, parseEther('100'));

    await setupWETHBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, parseEther('100'));

    await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
    await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

    dolomiteImpersonator = await impersonate(core.dolomiteMargin.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(
        trader.initialize(
          [core.tokens.usdc.address, core.tokens.usdt.address],
          [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']]
        ),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#callFunction', () => {
    it('should work normally with one report', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price],
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true]);

      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes
      );
      const latestReport = await trader.getLatestReport(core.tokens.usdc.address);
      expect(latestReport.timestamp).to.equal(timestamp);
      expect(await trader.tradeEnabled()).to.equal(true);
    });

    it('should work normally with 0 reports', async () => {
      expect(await trader.tradeEnabled()).to.equal(false);
      const extraBytes = defaultAbiCoder.encode(['bytes[]', 'bool'], [[], true]);

      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes
      );
      expect(await trader.tradeEnabled()).to.equal(true);
    });

    it('should update tradeEnabled to false', async () => {
      expect(await trader.tradeEnabled()).to.equal(false);
      let extraBytes = defaultAbiCoder.encode(['bytes[]', 'bool'], [[], true]);

      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes
      );
      expect(await trader.tradeEnabled()).to.equal(true);

      extraBytes = defaultAbiCoder.encode(['bytes[]', 'bool'], [[], false]);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes
      );
      expect(await trader.tradeEnabled()).to.equal(false);
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).callFunction(
          core.hhUser1.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['bytes[]', 'bool'], [[], true])
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#createActionsForInternalTrade', () => {
    it('should work normally with no fees', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee({ value: ZERO_BI });
      await trader.connect(core.governance).ownerSetAdminFee({ value: ZERO_BI });

      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price],
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(['bytes[]'], [payloads]);
      const actions = await trader.createActionsForInternalTrade({
        takerAccountId: 0,
        takerAccount: {
          owner: core.hhUser1.address,
          number: 0,
        },
        feeAccountId: 1,
        feeAccount: {
          owner: core.hhUser5.address,
          number: 0,
        },
        inputMarketId: core.marketIds.usdc,
        outputMarketId: core.marketIds.usdt,
        inputAmountWei: usdcAmount,
        trades: [
          {
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 1,
            amount: usdcAmount,
            minOutputAmount: ONE_BI,
          }
        ],
        extraData: extraBytes
      });
      expect(actions.length).to.equal(4);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      expect(actions[1].actionType).to.equal(ActionType.Trade);
      expect(actions[1].amount.value).to.equal(usdcAmount);

      expect(actions[2].actionType).to.equal(ActionType.Call);

      expect(actions[3].actionType).to.equal(ActionType.Transfer);
      expect(actions[3].amount.value).to.equal(ZERO_BI);

    });

    it('should work normally with admin fee and 1 trade', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee({ value: parseEther('.05') }); // 5%
      await trader.connect(core.governance).ownerSetAdminFee({ value: parseEther('.5') }); // 50%

      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price],
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(['bytes[]'], [payloads]);
      const actions = await trader.createActionsForInternalTrade({
        takerAccountId: 0,
        takerAccount: {
          owner: core.hhUser1.address,
          number: 0,
        },
        feeAccountId: 1,
        feeAccount: {
          owner: core.hhUser5.address,
          number: 0,
        },
        inputMarketId: core.marketIds.usdc,
        outputMarketId: core.marketIds.usdt,
        inputAmountWei: usdcAmount,
        trades: [
          {
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 2,
            amount: usdcAmount,
            minOutputAmount: ONE_BI,
          }
        ],
        extraData: extraBytes
      });
      expect(actions.length).to.equal(4);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      const adminFee = usdcAmount.div(20).div(2);
      expect(actions[1].actionType).to.equal(ActionType.Trade);
      expect(actions[1].amount.value).to.equal(usdcAmount.sub(adminFee));

      expect(actions[2].actionType).to.equal(ActionType.Call);

      expect(actions[3].actionType).to.equal(ActionType.Transfer);
      expect(actions[3].amount.value).to.equal(adminFee);
    });

    it('should work normally with admin fee and 2 trades', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee({ value: parseEther('.05') }); // 5%
      await trader.connect(core.governance).ownerSetAdminFee({ value: parseEther('.5') }); // 50%

      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price],
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(['bytes[]'], [payloads]);
      const actions = await trader.createActionsForInternalTrade({
        takerAccountId: 0,
        takerAccount: {
          owner: core.hhUser1.address,
          number: 0,
        },
        feeAccountId: 1,
        feeAccount: {
          owner: core.hhUser5.address,
          number: 0,
        },
        inputMarketId: core.marketIds.usdc,
        outputMarketId: core.marketIds.usdt,
        inputAmountWei: usdcAmount,
        trades: [
          {
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 2,
            amount: usdcAmount.div(2),
            minOutputAmount: ONE_BI,
          },
          {
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 3,
            amount: usdcAmount.div(2),
            minOutputAmount: ONE_BI,
          }
        ],
        extraData: extraBytes
      });
      expect(actions.length).to.equal(5);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      const adminFee = usdcAmount.div(20).div(2);

      expect(actions[1].actionType).to.equal(ActionType.Trade);
      expect(actions[1].amount.value).to.equal(usdcAmount.div(2).sub(adminFee.div(2)));

      expect(actions[2].actionType).to.equal(ActionType.Trade);
      expect(actions[2].amount.value).to.equal(usdcAmount.div(2).sub(adminFee.div(2)));

      expect(actions[3].actionType).to.equal(ActionType.Call);

      expect(actions[4].actionType).to.equal(ActionType.Transfer);
      expect(actions[4].amount.value).to.equal(adminFee);
    });

    it('should fail if trade total does not match input amount', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price],
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(['bytes[]'], [payloads]);
      await expectThrow(
        trader.createActionsForInternalTrade({
          takerAccountId: 0,
          takerAccount: {
            owner: core.hhUser1.address,
            number: 0,
          },
          feeAccountId: 1,
          feeAccount: {
            owner: core.hhUser5.address,
            number: 0,
          },
          inputMarketId: core.marketIds.usdc,
          outputMarketId: core.marketIds.usdt,
          inputAmountWei: usdcAmount,
          trades: [{
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 1,
            amount: usdcAmount,
            minOutputAmount: ONE_BI,
          },
          {
            makerAccount: {
              owner: core.hhUser1.address,
              number: 0,
            },
            makerAccountId: 2,
            amount: usdcAmount.div(2),
            minOutputAmount: ONE_BI,
          }],
          extraData: extraBytes
        }),
        'SmartDebtAutoTrader: Invalid swap amounts sum'
      );
    });
  });

  describe('#_calculateTotalFeePercentage', () => {
    beforeEach(async () => {
      await trader.connect(core.governance).ownerSetDepegFeePercentage({ value: depegFeePercentage });
      await trader.connect(core.governance).ownerSetSlightFeePercentage({ value: slightFeePercentage });
      await trader.connect(core.governance).ownerSetPairFeeSettings(
        core.marketIds.usdc,
        core.marketIds.usdt,
        feeSettings
      );
    });

    it('should work normally with depeg and 2x time multiplier', async () => {
      /*
      totalFee = baseFee * (1 + volatilityFee) * timeMultiplier
      = .05 * (1 + .1) * 2
      = .11
      */
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      const depegReport = {
        timestamp: futureTimestamp,
        bid: parseEther('0.95'),
        ask: parseEther('1.05'),
        benchmarkPrice: parseEther('1')
      };
      const normalReport = {
        timestamp: futureTimestamp + 100,
        bid: parseEther('0.99'),
        ask: parseEther('1.01'),
        benchmarkPrice: parseEther('1')
      };
      const totalFee = await trader.calculateTotalFeePercentage(depegReport, normalReport, pairPosition);
      expect(totalFee.value).to.equal(parseEther('.11'));
    });
  });

  describe('#_getVolatilityFeePercentage', () => {
    beforeEach(async () => {
      await trader.connect(core.governance).ownerSetDepegFeePercentage({ value: depegFeePercentage });
      await trader.connect(core.governance).ownerSetSlightFeePercentage({ value: slightFeePercentage });
    });

    it('should work if both reports are depeg', async () => {
      const feePercentage = await trader.getVolatilityFeePercentage(depegReport, depegReport, feeSettings);
      expect(feePercentage.value).to.equal(depegFeePercentage);
    });

    it('should work if one report is depeg', async () => {
      let feePercentage = await trader.getVolatilityFeePercentage(depegReport, slightReport, feeSettings);
      expect(feePercentage.value).to.equal(depegFeePercentage);

      feePercentage = await trader.getVolatilityFeePercentage(depegReport, normalReport, feeSettings);
      expect(feePercentage.value).to.equal(depegFeePercentage);

      feePercentage = await trader.getVolatilityFeePercentage(slightReport, depegReport, feeSettings);
      expect(feePercentage.value).to.equal(depegFeePercentage);

      feePercentage = await trader.getVolatilityFeePercentage(normalReport, depegReport, feeSettings);
      expect(feePercentage.value).to.equal(depegFeePercentage);
    });

    it('should work if both reports are slight', async () => {
      const feePercentage = await trader.getVolatilityFeePercentage(slightReport, slightReport, feeSettings);
      expect(feePercentage.value).to.equal(slightFeePercentage);
    });

    it('should work if one report is slight', async () => {
      let feePercentage = await trader.getVolatilityFeePercentage(slightReport, normalReport, feeSettings);
      expect(feePercentage.value).to.equal(slightFeePercentage);

      feePercentage = await trader.getVolatilityFeePercentage(normalReport, slightReport, feeSettings);
      expect(feePercentage.value).to.equal(slightFeePercentage);
    });

    it('should work if both reports are normal', async () => {
      const feePercentage = await trader.getVolatilityFeePercentage(normalReport, normalReport, feeSettings);
      expect(feePercentage.value).to.equal(ZERO_BI);
    });
  });

  describe('#_calculateTimeMultiplier', () => {
    it('should return 1 if time since oldest report is less than fee cliff seconds', async () => {
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      expect(await trader.calculateTimeMultiplier(futureTimestamp - 99, feeSettings)).to.equal(1);
    });

    it('should return 2 if time since oldest report is greater than or equal to fee cliff seconds', async () => {
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      expect(await trader.calculateTimeMultiplier(futureTimestamp - 100, feeSettings)).to.equal(2);
      expect(await trader.calculateTimeMultiplier(futureTimestamp - 101, feeSettings)).to.equal(2);
    });

    it('should return 3 if time since oldest report is greater than or equal to fee cliff seconds and fee compounding interval is 25', async () => {
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      expect(await trader.calculateTimeMultiplier(futureTimestamp - 100, feeSettings)).to.equal(2);
      expect(await trader.calculateTimeMultiplier(futureTimestamp - 125, feeSettings)).to.equal(3);
    });

    it('should return 1 if fee cliff seconds is 0', async () => {
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      expect(await trader.calculateTimeMultiplier(futureTimestamp, feeSettings)).to.equal(1);
    });

    it('should return 1 if fee compounding interval is 0', async () => {
      await setNextBlockTimestamp(futureTimestamp);
      await mine();
      expect(await trader.calculateTimeMultiplier(futureTimestamp, feeSettings)).to.equal(1);
    });
  });

  describe('#_getVolatilityLevel', () => {
    it('should work if report is depeg', async () => {
      expect(await trader.getVolatilityLevel(depegReport, feeSettings)).to.equal(VolatilityLevel.DEPEG);
    });

    it('should work if report is slight', async () => {
      expect(await trader.getVolatilityLevel(slightReport, feeSettings)).to.equal(VolatilityLevel.SLIGHT);
    });

    it('should work if report is normal', async () => {
      expect(await trader.getVolatilityLevel(normalReport, feeSettings)).to.equal(VolatilityLevel.NORMAL);
    });

    it('should return normal if depeg threshold is 0', async () => {
      const feeSettings = {
        feeOverride: { value: ZERO_BI },
        depegThreshold: { value: ZERO_BI },
        slightThreshold: { value: parseEther('0.05') },
        feeCliffSeconds: 0,
        feeCompoundingInterval: 0
      };
      expect(await trader.getVolatilityLevel(depegReport, feeSettings)).to.equal(VolatilityLevel.NORMAL);
    });

    it('should return normal if slight threshold is 0', async () => {
      const feeSettings = {
        feeOverride: { value: ZERO_BI },
        depegThreshold: { value: parseEther('0.1') },
        slightThreshold: { value: ZERO_BI },
        feeCliffSeconds: 0,
        feeCompoundingInterval: 0
      };
      expect(await trader.getVolatilityLevel(slightReport, feeSettings)).to.equal(VolatilityLevel.NORMAL);
    });
  });

  describe('#_min', () => {
    it('should work if first value is smaller', async () => {
      expect(await trader.min(5, 10)).to.eq(5);
    });

    it('should work if second value is smaller', async () => {
      expect(await trader.min(10, 5)).to.eq(5);
    });

    it('should work if values are equal', async () => {
      expect(await trader.min(5, 5)).to.eq(5);
    });
  });

  describe('#getTradeCost', () => {
    it('should fail if trade is not enabled', async () => {
      const adminFeeAmount = usdcAmount.div(10).div(2);
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Trade is not enabled'
      );
    });

    it('should fail if user does not have the pair set', async () => {
      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: User does not have the pair set'
      );
    });

    it('should fail if output amount is insufficient', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [usdcAmount.mul(2), adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Insufficient output token amount'
      );
    });
  });

  describe('#getTradeCost_smartCollateral_noDynamicFee', () => {
    it('should work normally with smart collateral when prices are equal and no dynamic fee', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price], // $1 each
        timestamp
      );
      const extraBytes = defaultAbiCoder.encode(
        ['bytes[]', 'bool'],
        [payloads, true]
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes,
        { gasPrice: BigNumber.from('1000000000000') }
      );

      /*
      amountIn: 100.000000 (USDC)
      globalFee: 10 (USDC)
      adminFee: 5 (USDC)
      amountOut: 90 * $1 / $1 = 90 (USDT)
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('90000000'));
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with smart collateral and bid ask are not equal', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price], // $1 each
        timestamp,
        [parseEther('0.99'), parseEther('0.99')], // $.99 bid price
        [parseEther('1.01'), parseEther('1.01')] // $1.01 ask price
      );
      const extraBytes = defaultAbiCoder.encode(
        ['bytes[]', 'bool'],
        [payloads, true]
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        extraBytes,
        { gasPrice: BigNumber.from('1000000000000') }
      );

      /*
      amountIn: 100.000000 (USDC)
      globalFee: 10 (USDC)
      adminFee: 5 (USDC)
      amountOut: 90 usdc * $.99 (usdc bid) / $1.01 (usdt ask) = 88.217821 (USDT)
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('88217821'));
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with smart collateral when prices are not equal', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price.mul(2), price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      /*
      amountIn: 100.000000 (USDC)
      globalFee: 10 (USDC)
      adminFee: 5 (USDC)
      amountOut: 90 * $1 / $2 = 45 (USDT)
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('45000000'));
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with exchange rate between min and max', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        parseEther('.9'),
        parseEther('1.2')
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      // exchange rate comes to 1.10000001ish
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price.mul(110).div(100), price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      /*
      amountIn: 100.000000 (USDC)
      globalFee: 10 (USDC)
      adminFee: 5 (USDC)
      amountOut: 90 * $1 / $1.1 = 81.818181 (USDT)
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('81818181')); // $81
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with exchange rate between min and max when market ids are reversed', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdtAmount);

      await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        parseEther('.9'),
        parseEther('1.1')
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      // exchange rate comes to .9091ish
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price.mul(110).div(100)],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      /*
      amountIn: 100.000000 (USDT)
      globalFee: 10 (USDT)
      adminFee: 5 (USDT)
      amountOut: 90 * $1 / $1.1 = 81.818181 (USDC)
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdt,
        core.marketIds.usdc,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('81818181')); // $81
      expect(outputAmount.sign).to.equal(true);
    });

    it('should fail if exchange rate is above max', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        parseEther('.98'),
        parseEther('1.02')
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price.mul(2), price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount]),
        ),
        'SmartDebtAutoTrader: Exchange rate is out of range'
      );
    });

    it('should fail if exchange rate is below min', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        parseEther('.98'),
        parseEther('1.02')
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price.mul(2)],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount]),
        ),
        'SmartDebtAutoTrader: Exchange rate is out of range'
      );
    });

    it('should fail if smart collateral pair is not active', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Collateral pair is not active'
      );
    });

    it('should fail if the user does not have enough collateral', async () => {
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );
      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
          { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Insufficient collateral'
      );
    });
  });

  describe('#getTradeCost_smartDebt_noDynamicFee_bidAskEqual', () => {
    it('should work normally with smart debt when prices are equal', async () => {
      await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.To
      );
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      /*
      amountIn: 100 USDC
      globalFee: 10 USDC
      adminFee: 5 USDC
      amountOut: 90 USDC * $1 / $1 = 90 USDT
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: borrowAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('90000000'));
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with smart debt when prices are not equal', async () => {
      await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.To
      );
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price.mul(2), price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      /*
      amountIn: 100 USDC
      globalFee: 10 USDC
      adminFee: 5 USDC
      amountOut: 90 USDC * $1 / $2 = 45 USDT
      */
      const outputAmount = await trader.callStatic.getTradeCost(
        core.marketIds.usdc,
        core.marketIds.usdt,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        { owner: core.hhUser2.address, number: borrowAccountNumber },
        { value: ZERO_BI, sign: false },
        { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
        defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
      );
      expect(outputAmount.value).to.equal(BigNumber.from('45000000')); // $45
      expect(outputAmount.sign).to.equal(true);
    });

    it('should fail if smart debt pair is not active', async () => {
      await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.To
      );
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );
      await trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: borrowAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Debt pair is not active'
      );
    });

    it('should fail if the user does not have enough debt', async () => {
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt,
        ZERO_BI,
        ZERO_BI
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const payloads = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [price, price],
        timestamp
      );
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bytes[]', 'bool'], [payloads, true])
      );

      await expectThrow(
        trader.callStatic.getTradeCost(
          core.marketIds.usdc,
          core.marketIds.usdt,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          { owner: core.hhUser2.address, number: borrowAccountNumber },
          { value: ZERO_BI, sign: false },
          { value: ZERO_BI, sign: false },
        { value: usdcAmount.sub(adminFeeAmount), sign: false },
          defaultAbiCoder.encode(['uint256', 'uint256'], [ONE_BI, adminFeeAmount])
        ),
        'SmartDebtAutoTrader: Insufficient debt'
      );
    });
  });
});

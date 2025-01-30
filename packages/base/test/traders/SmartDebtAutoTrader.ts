import { expect } from 'chai';
import { GenericTraderProxyV2, SmartDebtAutoTrader, TestSmartDebtAutoTrader } from '../../src/types';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, BYTES_ZERO, Network, ONE_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupUSDTBalance, setupWETHBalance } from '../utils/setup';
import { createAndUpgradeDolomiteRegistry, createGenericTraderProxyV2, createTestSmartDebtAutoTrader } from '../utils/dolomite';
import { BigNumber } from 'ethers';
import { ActionType, BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { PairType } from '../utils/trader-utils';

const USDC_USDT_PAIR_BYTES = '0x89832631fb3c3307a103ba2c84ab569c64d6182a18893dcd163f0f1c2090733a';
const usdcAmount = BigNumber.from('100000000'); // $100
const usdtAmount = BigNumber.from('200000000');
const defaultAccountNumber = 0;
const borrowAccountNumber = BigNumber.from('123');

describe('SmartDebtAutoTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestSmartDebtAutoTrader;
  let genericTraderProxy: GenericTraderProxyV2;
  let dolomiteImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_470_000,
    });
    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(
      core.borrowPositionProxyV2.address
    );

    dolomiteImpersonator = await impersonate(core.dolomiteMargin.address, true);
    genericTraderProxy = await createGenericTraderProxyV2(core, Network.ArbitrumOne);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    trader = await createTestSmartDebtAutoTrader(core, Network.ArbitrumOne);
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

    const price = BigNumber.from('1000000000000000000000000000000'); // $1 for tokens with 6 decimals
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdc.address, price);
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdt.address, price);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.usdc,
      core.testEcosystem!.testPriceOracle.address
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.usdt,
      core.testEcosystem!.testPriceOracle.address
    );

    await trader.connect(core.governance).ownerSetGlobalFee(parseEther('.1'));
    await trader.connect(core.governance).ownerSetAdminFee(parseEther('.5'));

    await setupWETHBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, parseEther('100'));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await trader.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await trader.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        trader.initialize(),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#callFunction', () => {
    it('should work normally', async () => {
      expect(await trader.tradeEnabled()).to.equal(false);

      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
      );
      expect(await trader.tradeEnabled()).to.equal(true);

      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [false])
      );
      expect(await trader.tradeEnabled()).to.equal(false);
    });

    it('should fail if sender is not trusted internal trade caller', async () => {
      await expectThrow(
        trader.connect(dolomiteImpersonator).callFunction(
          core.hhUser1.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['bool'], [true])
        ),
        'InternalAutoTraderBase: Invalid sender'
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).callFunction(
          core.hhUser1.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['bool'], [true])
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#createActionsForInternalTrade', () => {
    it('should work normally with no fees', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee(ZERO_BI);
      await trader.connect(core.governance).ownerSetAdminFee(ZERO_BI);

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
        extraData: BYTES_EMPTY
      });
      expect(actions.length).to.equal(4);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      expect(actions[1].actionType).to.equal(ActionType.Transfer);
      expect(actions[1].amount.value).to.equal(ZERO_BI);

      expect(actions[2].actionType).to.equal(ActionType.Trade);
      expect(actions[2].amount.value).to.equal(usdcAmount);

      expect(actions[3].actionType).to.equal(ActionType.Call);
    });

    it('should work normally with admin fee and 1 trade', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee(parseEther('.05')); // 5%
      await trader.connect(core.governance).ownerSetAdminFee(parseEther('.5')); // 50%

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
        extraData: BYTES_EMPTY
      });
      expect(actions.length).to.equal(4);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      const adminFee = usdcAmount.div(20).div(2);
      expect(actions[1].actionType).to.equal(ActionType.Transfer);
      expect(actions[1].amount.value).to.equal(adminFee);

      expect(actions[2].actionType).to.equal(ActionType.Trade);
      expect(actions[2].amount.value).to.equal(usdcAmount.sub(adminFee));

      expect(actions[3].actionType).to.equal(ActionType.Call);
    });

    it('should work normally with admin fee and 2 trades', async () => {
      await trader.connect(core.governance).ownerSetGlobalFee(parseEther('.05')); // 5%
      await trader.connect(core.governance).ownerSetAdminFee(parseEther('.5')); // 50%

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
        extraData: BYTES_EMPTY
      });
      expect(actions.length).to.equal(5);
      expect(actions[0].actionType).to.equal(ActionType.Call);

      const adminFee = usdcAmount.div(20).div(2);
      expect(actions[1].actionType).to.equal(ActionType.Transfer);
      expect(actions[1].amount.value).to.equal(adminFee);

      expect(actions[2].actionType).to.equal(ActionType.Trade);
      expect(actions[2].amount.value).to.equal(usdcAmount.div(2).sub(adminFee.div(2)));

      expect(actions[3].actionType).to.equal(ActionType.Trade);
      expect(actions[3].amount.value).to.equal(usdcAmount.div(2).sub(adminFee.div(2)));

      expect(actions[4].actionType).to.equal(ActionType.Call);
    });

    it('should fail if trade total does not match input amount', async () => {
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
          extraData: BYTES_EMPTY
        }),
        'SmartDebtAutoTrader: Invalid swap amounts sum'
      );
    });
  });

  describe('#getTradeCost', () => {
    it('should work normally with smart collateral when prices are equal', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
      );
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
      expect(outputAmount.value).to.equal(usdcAmount.sub(adminFeeAmount.mul(2)));
      expect(outputAmount.sign).to.equal(true);
    });

    it('should work normally with smart collateral when prices are not equal', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      const price = BigNumber.from('1000000000000000000000000000000');
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdt.address, price.mul(2));

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
      );
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
      expect(outputAmount.value).to.equal(BigNumber.from('45000000')); // $45
      expect(outputAmount.sign).to.equal(true);
    });

    it('should fail if smart collateral pair is not active', async () => {
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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

    it('should work normally with smart debt when prices are equal', async () => {
      await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.To
      );
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
      );
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
      expect(outputAmount.value).to.equal(usdcAmount.sub(adminFeeAmount.mul(2)));
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
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      const price = BigNumber.from('1000000000000000000000000000000');
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdt.address, price.mul(2));

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
      );
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
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const adminFeeAmount = usdcAmount.div(10).div(2);
      await trader.connect(dolomiteImpersonator).callFunction(
        genericTraderProxy.address,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['bool'], [true])
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

  // describe('#getTradeCost_integration', () => {
  //   it('should work normally with smart collateral', async () => {

  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
  //     await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

  //     await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_COLLATERAL,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await genericTraderProxy.swapExactInputForOutput({
  //       accountNumber: defaultAccountNumber,
  //       marketIdsPath: zapParams.marketIdsPath,
  //       inputAmountWei: zapParams.inputAmountWei,
  //       minOutputAmountWei: zapParams.minOutputAmountWei,
  //       tradersPath: zapParams.tradersPath,
  //       makerAccounts: zapParams.makerAccounts,
  //       userConfig: zapParams.userConfig,
  //     });
  //     const usdtBal = (await core.dolomiteMargin.getAccountWei(
  //       { owner: core.hhUser1.address, number: defaultAccountNumber },
  //       core.marketIds.usdt)
  //     ).value;
  //     await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
  //     await expectProtocolBalanceIsGreaterThan(
  //       core,
  //       { owner: core.hhUser1.address, number: defaultAccountNumber },
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       ZERO_BI
  //     );
  //     await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
  //     await expectProtocolBalance(
  //       core,
  //       core.hhUser2,
  //       defaultAccountNumber,
  //       core.marketIds.usdt,
  //       usdtAmount.sub(usdtBal)
  //     );
  //   });

  //   it('should work normally with smart debt', async () => {
  //     await disableInterestAccrual(core, core.marketIds.usdc);
  //     await disableInterestAccrual(core, core.marketIds.usdt);

  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

  //     await setupWETHBalance(core, core.hhUser2, ONE_ETH_BI, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
  //     await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
  //       borrowAccountNumber,
  //       defaultAccountNumber,
  //       core.marketIds.usdc,
  //       usdcAmount,
  //       BalanceCheckFlag.To,
  //     );
  //     await expectProtocolBalance(
  //       core,
  //       core.hhUser2,
  //       borrowAccountNumber,
  //       core.marketIds.usdc,
  //       ZERO_BI.sub(usdcAmount)
  //     );

  //     await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       borrowAccountNumber,
  //       PairType.SMART_DEBT,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: borrowAccountNumber },
  //       core,
  //     );
  //     await genericTraderProxy.swapExactInputForOutput({
  //       accountNumber: defaultAccountNumber,
  //       marketIdsPath: zapParams.marketIdsPath,
  //       inputAmountWei: zapParams.inputAmountWei,
  //       minOutputAmountWei: zapParams.minOutputAmountWei,
  //       tradersPath: zapParams.tradersPath,
  //       makerAccounts: zapParams.makerAccounts,
  //       userConfig: zapParams.userConfig,
  //     });
  //     const usdtBal = (await core.dolomiteMargin.getAccountWei(
  //       { owner: core.hhUser1.address, number: defaultAccountNumber },
  //       core.marketIds.usdt)
  //     ).value;
  //     await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
  //     await expectProtocolBalanceIsGreaterThan(
  //       core,
  //       { owner: core.hhUser1.address, number: defaultAccountNumber },
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       ZERO_BI
  //     );
  //     await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
  //     await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdt, ZERO_BI.sub(usdtBal));
  //   });

  //   it('should fail if smart collateral user has insufficient collateral', async () => {
  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

  //     await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_COLLATERAL,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: Insufficient collateral'
  //     );
  //   });

  //   it('should fail if smart debt user has insufficient debt', async () => {
  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

  //     await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_DEBT,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: Insufficient debt'
  //     );
  //   });

  //   it('should fail if user does not have a pair set or has a different pair set', async () => {
  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: User does not have the pair set'
  //     );

  //     await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.dai);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_DEBT,
  //       core.marketIds.usdc,
  //       core.marketIds.dai
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: User does not have the pair set'
  //     );
  //   });

  //   it('should fail if collateral pair is not active', async () => {
  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
  //     await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_COLLATERAL,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );
  //     await trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: Collateral pair is not active'
  //     );
  //   });

  //   it('should fail if debt pair is not active', async () => {
  //     await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
  //     await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
  //     await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
  //     await trader.connect(core.hhUser2).userSetPair(
  //       defaultAccountNumber,
  //       PairType.SMART_DEBT,
  //       core.marketIds.usdc,
  //       core.marketIds.usdt
  //     );
  //     await trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

  //     const zapParams = await getSmartDebtZapParams(
  //       core.marketIds.usdc,
  //       MAX_UINT_256_BI,
  //       core.marketIds.usdt,
  //       usdcAmount,
  //       trader,
  //       { owner: core.hhUser2.address, number: defaultAccountNumber },
  //       core,
  //     );
  //     await expectThrow(
  //       genericTraderProxy.swapExactInputForOutput({
  //         accountNumber: defaultAccountNumber,
  //         marketIdsPath: zapParams.marketIdsPath,
  //         inputAmountWei: zapParams.inputAmountWei,
  //         minOutputAmountWei: zapParams.minOutputAmountWei,
  //         tradersPath: zapParams.tradersPath,
  //         makerAccounts: zapParams.makerAccounts,
  //         userConfig: zapParams.userConfig,
  //       }),
  //       'SmartDebtAutoTrader: Debt pair is not active'
  //     );
  //   });
  // });

  describe('#userSetPair', () => {
    it('should work normally for smart debt', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);

      const res = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.SMART_DEBT,
        pairBytes: USDC_USDT_PAIR_BYTES
      });
      await expectPair(trader, core.hhUser1.address, defaultAccountNumber, PairType.SMART_DEBT, USDC_USDT_PAIR_BYTES);
    });

    it('should work normally for smart collateral', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);

      const res = await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.SMART_COLLATERAL,
        pairBytes: USDC_USDT_PAIR_BYTES
      });
    });

    it('should work normally to reset to empty', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser1).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      const res = await trader.connect(core.hhUser1).userSetPair(defaultAccountNumber, PairType.NONE, 0, 0);
      await expectEvent(trader, res, 'UserToPairSet', {
        user: core.hhUser1.address,
        accountNumber: defaultAccountNumber,
        pairType: PairType.NONE,
        pairBytes: BYTES_ZERO
      });
      await expectEmptyPair(trader, core.hhUser1.address, defaultAccountNumber);
    });

    it('should fail if pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          PairType.SMART_DEBT,
          core.marketIds.usdc,
          core.marketIds.usdt
        ),
        'SmartDebtAutoTrader: Pair does not exist'
      );
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          PairType.SMART_COLLATERAL,
          core.marketIds.usdc,
          core.marketIds.usdt
        ),
        'SmartDebtAutoTrader: Pair does not exist'
      );
    });

    it('should revert if market ids are not zero and type is NONE', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).userSetPair(
          defaultAccountNumber,
          PairType.NONE,
          core.marketIds.usdc,
          core.marketIds.usdt
        ),
        'Invalid pair type'
      );
    });
  });

  describe('#ownerAddSmartDebtPair', () => {
    it('should work normally if already sorted', async () => {
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;

      const res = await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectEvent(trader, res, 'SmartDebtPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should work normally if not sorted', async () => {
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;

      const res = await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc);
      await expectEvent(trader, res, 'SmartDebtPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should revert if marketIds are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtAutoTrader: Market IDs must be different'
      );
    });

    it('should fail if already a pair', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtAutoTrader: Pair already exists'
      );
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtAutoTrader: Pair already exists'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemoveSmartDebtPair', () => {
    it('should work normally if already sorted', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      const res = await trader.connect(core.governance).ownerRemoveSmartDebtPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartDebtPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should work normally if not sorted', async () => {
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      const res = await trader.connect(core.governance).ownerRemoveSmartDebtPair(
        core.marketIds.usdt,
        core.marketIds.usdc
      );
      await expectEvent(trader, res, 'SmartDebtPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartDebtPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should fail if pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtAutoTrader: Pair does not exist'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerAddSmartCollateralPair', () => {
    it('should work normally if already sorted', async () => {
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;

      const res = await trader.connect(core.governance).ownerAddSmartCollateralPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartCollateralPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should work normally if not sorted', async () => {
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;

      const res = await trader.connect(core.governance).ownerAddSmartCollateralPair(
        core.marketIds.usdt,
        core.marketIds.usdc
      );
      await expectEvent(trader, res, 'SmartCollateralPairAdded', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.true;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.true;
    });

    it('should fail if marketIds are the same', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdc),
        'SmartDebtAutoTrader: Market IDs must be different'
      );
    });

    it('should fail if pair already exists', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtAutoTrader: Pair already exists'
      );
      await expectThrow(
        trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc),
        'SmartDebtAutoTrader: Pair already exists'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemoveSmartCollateralPair', () => {
    it('should work normally if already sorted', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const res = await trader.connect(core.governance).ownerRemoveSmartCollateralPair(
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await expectEvent(trader, res, 'SmartCollateralPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should work normally if not sorted', async () => {
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const res = await trader.connect(core.governance).ownerRemoveSmartCollateralPair(
        core.marketIds.usdt,
        core.marketIds.usdc
      );
      await expectEvent(trader, res, 'SmartCollateralPairRemoved', {
        marketId1: core.marketIds.usdc,
        marketId2: core.marketIds.usdt,
      });
      expect(await trader.isSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt)).to.be.false;
      expect(await trader.isSmartCollateralPair(core.marketIds.usdt, core.marketIds.usdc)).to.be.false;
    });

    it('should fail if pair does not exist', async () => {
      await expectThrow(
        trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        'SmartDebtAutoTrader: Pair does not exist'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetGlobalFee', () => {
    it('should work normally', async () => {
      expect(await trader.globalFee()).to.equal(parseEther('.1'));
      const res = await trader.connect(core.governance).ownerSetGlobalFee(parseEther('.9'));
      await expectEvent(trader, res, 'GlobalFeeSet', {
        globalFee: parseEther('.9'),
      });
      expect(await trader.globalFee()).to.equal(parseEther('.9'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetGlobalFee(parseEther('.9')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetAdminFee', () => {
    it('should work normally', async () => {
      expect(await trader.adminFee()).to.equal(parseEther('.5'));
      const res = await trader.connect(core.governance).ownerSetAdminFee(parseEther('.9'));
      await expectEvent(trader, res, 'AdminFeeSet', {
        adminFee: parseEther('.9'),
      });
      expect(await trader.adminFee()).to.equal(parseEther('.9'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetAdminFee(parseEther('.9')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetPairFee', () => {
    it('should work normally', async () => {
      expect(await trader.pairFee(core.marketIds.usdc, core.marketIds.usdt)).to.equal(ZERO_BI);
      const res = await trader.connect(core.governance).ownerSetPairFee(
        core.marketIds.usdc,
        core.marketIds.usdt,
        parseEther('.9')
      );
      await expectEvent(trader, res, 'PairFeeSet', {
        pairBytes: USDC_USDT_PAIR_BYTES,
        fee: parseEther('.9'),
      });
      expect(await trader.pairFee(core.marketIds.usdc, core.marketIds.usdt)).to.equal(parseEther('.9'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetPairFee(core.marketIds.usdc, core.marketIds.usdt, parseEther('.9')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#testGetFeesByMarketIds', () => {
    it('should work normally', async () => {
      const res = await trader.testGetFeesByMarketIds(core.marketIds.usdc, core.marketIds.usdt);
      expect(res[0]).to.equal(parseEther('.5'));
      expect(res[1]).to.equal(parseEther('.1'));
    });

    it('should work normally if pair has override fee', async () => {
      await trader.connect(core.governance).ownerSetPairFee(core.marketIds.usdc, core.marketIds.usdt, parseEther('.9'));
      const res = await trader.testGetFeesByMarketIds(core.marketIds.usdc, core.marketIds.usdt);
      expect(res[0]).to.equal(parseEther('.5'));
      expect(res[1]).to.equal(parseEther('.9'));
    });
  });

  describe('#testGetFeesByPairBytes', () => {
    it('should work normally', async () => {
      const res = await trader.testGetFeesByPairBytes(USDC_USDT_PAIR_BYTES);
      expect(res[0]).to.equal(parseEther('.5'));
      expect(res[1]).to.equal(parseEther('.1'));
    });

    it('should work normally if pair has override fee', async () => {
      await trader.connect(core.governance).ownerSetPairFee(core.marketIds.usdc, core.marketIds.usdt, parseEther('.9'));
      const res = await trader.testGetFeesByPairBytes(USDC_USDT_PAIR_BYTES);
      expect(res[0]).to.equal(parseEther('.5'));
      expect(res[1]).to.equal(parseEther('.9'));
    });
  });
});

async function expectEmptyPair(trader: SmartDebtAutoTrader, user: string, accountNumber: number) {
  const pair = await trader.userToPair(user, accountNumber);
  expect(pair.pairType).to.equal(PairType.NONE);
  expect(pair.pairBytes).to.equal(BYTES_ZERO);
}

async function expectPair(
  trader: SmartDebtAutoTrader,
  user: string,
  accountNumber: number,
  pairType: PairType,
  pairBytes: string
) {
  const pair = await trader.userToPair(user, accountNumber);
  expect(pair.pairType).to.equal(pairType);
  expect(pair.pairBytes).to.equal(pairBytes);
}

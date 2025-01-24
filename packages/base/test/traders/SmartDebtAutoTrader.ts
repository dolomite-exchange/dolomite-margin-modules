import { expect } from 'chai';
import { GenericTraderProxyV2, SmartDebtAutoTrader } from '../../src/types';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_ZERO, MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupUSDTBalance, setupWETHBalance } from '../utils/setup';
import { createAndUpgradeDolomiteRegistry, createGenericTraderProxyV2, createSmartDebtAutoTrader } from '../utils/dolomite';
import { BigNumber } from 'ethers';
import { getSmartDebtZapParams } from '../utils/zap-utils';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';

const USDC_USDT_PAIR_BYTES = '0x89832631fb3c3307a103ba2c84ab569c64d6182a18893dcd163f0f1c2090733a';
const usdcAmount = BigNumber.from('100000000');
const usdtAmount = BigNumber.from('200000000');
const defaultAccountNumber = 0;
const borrowAccountNumber = BigNumber.from('123');

export enum PairType {
  NONE,
  SMART_DEBT,
  SMART_COLLATERAL
}

describe('SmartDebtAutoTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: SmartDebtAutoTrader;
  let genericTraderProxy: GenericTraderProxyV2;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_470_000,
    });
    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(
      core.borrowPositionProxyV2.address
    );

    genericTraderProxy = await createGenericTraderProxyV2(core, Network.ArbitrumOne);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    trader = await createSmartDebtAutoTrader(core);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(trader.address, true);
    await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTraders(
      [trader.address],
      [true]
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await trader.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        trader.initialize(core.dolomiteMargin.address),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#getTradeCost', () => {
    it('should work normally with smart collateral', async () => {
      await disableInterestAccrual(core, core.marketIds.usdc);
      await disableInterestAccrual(core, core.marketIds.usdt);

      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      const usdtBal = (await core.dolomiteMargin.getAccountWei(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.usdt)
      ).value;
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.usdt,
        usdcAmount,
        ZERO_BI
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(
        core,
        core.hhUser2,
        defaultAccountNumber,
        core.marketIds.usdt,
        usdtAmount.sub(usdtBal)
      );
    });

    it('should work normally with smart debt', async () => {
      await disableInterestAccrual(core, core.marketIds.usdc);
      await disableInterestAccrual(core, core.marketIds.usdt);

      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      await setupWETHBalance(core, core.hhUser2, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(
        core,
        core.hhUser2,
        borrowAccountNumber,
        core.marketIds.usdc,
        ZERO_BI.sub(usdcAmount)
      );

      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        borrowAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: borrowAccountNumber },
        core,
      );
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      const usdtBal = (await core.dolomiteMargin.getAccountWei(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.usdt)
      ).value;
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.usdt,
        usdcAmount,
        ZERO_BI
      );
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdt, ZERO_BI.sub(usdtBal));
    });

    it('should fail if smart collateral user has insufficient collateral', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: Insufficient collateral'
      );
    });

    it('should fail if smart debt user has insufficient debt', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: Insufficient debt'
      );
    });

    it('should fail if user does not have a pair set or has a different pair set', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: User does not have the pair set'
      );

      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.dai);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.dai
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: User does not have the pair set'
      );
    });

    it('should fail if collateral pair is not active', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
      await trader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await trader.connect(core.governance).ownerRemoveSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: Collateral pair is not active'
      );
    });

    it('should fail if debt pair is not active', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
      await trader.connect(core.governance).ownerAddSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);
      await trader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_DEBT,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await trader.connect(core.governance).ownerRemoveSmartDebtPair(core.marketIds.usdc, core.marketIds.usdt);

      const zapParams = await getSmartDebtZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        usdcAmount,
        trader,
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        core,
      );
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'SmartDebtAutoTrader: Debt pair is not active'
      );
    });
  });

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

import {
  ActionType,
  AmountDenomination,
  AmountReference,
  BalanceCheckFlag,
  ExpiryCallFunctionType,
} from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { CustomTestToken, TestAccountActionLib, TestAccountActionLib__factory } from '../../src/types';
import { createContractWithAbi, createTestToken } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  expectAssetAmountToEq,
  expectProtocolBalance,
  expectThrow,
  expectThrowBalanceFlagError,
  expectWalletBalance,
} from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../utils/setup';

const amountWei = BigNumber.from('200000000');
const amountWeiBig = BigNumber.from('500000000');
const defaultAccountNumber = BigNumber.from('0');
const otherAccountNumber = BigNumber.from('123');
const defaultAmountStruct = {
  sign: false,
  denomination: AmountDenomination.Wei,
  ref: AmountReference.Delta,
  value: ZERO_BI,
};

const abiCoder = ethers.utils.defaultAbiCoder;

describe('AccountActionLib', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let testLib: TestAccountActionLib;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    testLib = await createContractWithAbi<TestAccountActionLib>(
      TestAccountActionLib__factory.abi,
      TestAccountActionLib__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(testLib.address, true);

    underlyingToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      underlyingToken.address,
      '1000000000000000000', // $1.00 in USDC
    );
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, underlyingToken, false);

    otherToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00 in USDC
    );
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    await underlyingToken.connect(core.hhUser1).addBalance(core.dolomiteMargin.address, amountWeiBig);
    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);

    await otherToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWeiBig);
    await otherToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWeiBig);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function performDeposit(marketId: BigNumber, amountWei: BigNumber) {
    await testLib.connect(core.hhUser1).deposit(
      core.hhUser1.address,
      core.hhUser1.address,
      defaultAccountNumber,
      marketId,
      { sign: true, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
    );
    await expectProtocolBalance(
      core,
      core.hhUser1.address,
      defaultAccountNumber,
      marketId,
      amountWei,
    );
    await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
  }

  describe('#deposit', () => {
    it('should work normally', async () => {
      await testLib.connect(core.hhUser1).deposit(
        core.hhUser1.address,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        { sign: true, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        amountWei,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });
  });

  describe('#withdraw', () => {
    it('should work normally when flag is set to Both', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).withdraw(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        underlyingMarketId,
        { sign: false, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally when flag is set to From', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).withdraw(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        underlyingMarketId,
        { sign: false, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
        BalanceCheckFlag.From,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally when flag is set to To', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).withdraw(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        underlyingMarketId,
        { sign: false, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally when flag is set to None', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).withdraw(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        underlyingMarketId,
        { sign: false, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail normally when flag is set to Both/From and account goes negative', async () => {
      await performDeposit(underlyingMarketId, amountWei);
      await performDeposit(otherMarketId, amountWeiBig);

      await expectThrowBalanceFlagError(
        testLib.connect(core.hhUser1).withdraw(
          core.hhUser1.address,
          defaultAccountNumber,
          core.hhUser1.address,
          underlyingMarketId,
          { sign: false, value: amountWeiBig, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
          BalanceCheckFlag.Both,
        ),
        core.hhUser1,
        defaultAccountNumber,
        underlyingMarketId,
      );
      await expectThrowBalanceFlagError(
        testLib.connect(core.hhUser1).withdraw(
          core.hhUser1.address,
          defaultAccountNumber,
          core.hhUser1.address,
          underlyingMarketId,
          { sign: false, value: amountWeiBig, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
          BalanceCheckFlag.From,
        ),
        core.hhUser1,
        defaultAccountNumber,
        underlyingMarketId,
      );
    });
  });

  describe('#transfer', () => {
    it('should work normally when flag is set to Both', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        AmountDenomination.Wei,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally when flag is set to From', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        AmountDenomination.Wei,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally when flag is set to To', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        AmountDenomination.Wei,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally when flag is set to None', async () => {
      await performDeposit(underlyingMarketId, amountWei);

      await testLib.connect(core.hhUser1).transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        AmountDenomination.Wei,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should fail normally when flag is set to Both/From/To and account goes negative', async () => {
      await performDeposit(underlyingMarketId, amountWei);
      await performDeposit(otherMarketId, amountWeiBig);

      await expectThrowBalanceFlagError(
        testLib.connect(core.hhUser1).transfer(
          core.hhUser1.address,
          defaultAccountNumber,
          core.hhUser1.address,
          otherAccountNumber,
          underlyingMarketId,
          AmountDenomination.Wei,
          amountWeiBig,
          BalanceCheckFlag.Both,
        ),
        core.hhUser1,
        defaultAccountNumber,
        underlyingMarketId,
      );
      await expectThrowBalanceFlagError(
        testLib.connect(core.hhUser1).transfer(
          core.hhUser1.address,
          defaultAccountNumber,
          core.hhUser1.address,
          otherAccountNumber,
          underlyingMarketId,
          AmountDenomination.Wei,
          amountWeiBig,
          BalanceCheckFlag.From,
        ),
        core.hhUser1,
        defaultAccountNumber,
        underlyingMarketId,
      );

      await testLib.connect(core.hhUser1).transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        AmountDenomination.Wei,
        amountWeiBig,
        BalanceCheckFlag.None,
      );
      await expectThrowBalanceFlagError(
        testLib.connect(core.hhUser1).transfer(
          core.hhUser1.address,
          otherAccountNumber,
          core.hhUser1.address,
          defaultAccountNumber,
          underlyingMarketId,
          AmountDenomination.Wei,
          amountWei,
          BalanceCheckFlag.To,
        ),
        core.hhUser1,
        defaultAccountNumber,
        underlyingMarketId,
      );
    });
  });

  describe('#encodeCallAction', () => {
    it('should work normally', async () => {
      const accountId = '123';
      const callData = '0x123321';
      const callAction = await testLib.connect(core.hhUser1).encodeCallAction(
        accountId,
        core.expiry.address,
        callData,
      );
      expect(callAction.actionType).to.eq(ActionType.Call);
      expect(callAction.accountId).to.eq(accountId);
      expectAssetAmountToEq(callAction.amount, defaultAmountStruct);
      expect(callAction.primaryMarketId).to.eq(ZERO_BI);
      expect(callAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(callAction.otherAddress).to.eq(core.expiry.address);
      expect(callAction.otherAccountId).to.eq(ZERO_BI);
      expect(callAction.data).to.eq(callData);
    });
  });

  describe('#encodeDepositAction', () => {
    it('should work normally', async () => {
      const accountId = '123';
      const amountStruct = {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountWeiBig,
      };
      const depositAction = await testLib.connect(core.hhUser1).encodeDepositAction(
        accountId,
        underlyingMarketId,
        amountStruct,
        core.hhUser1.address,
      );
      expect(depositAction.actionType).to.eq(ActionType.Deposit);
      expect(depositAction.accountId).to.eq(accountId);
      expectAssetAmountToEq(depositAction.amount, amountStruct);
      expect(depositAction.primaryMarketId).to.eq(underlyingMarketId);
      expect(depositAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(depositAction.otherAddress).to.eq(core.hhUser1.address);
      expect(depositAction.otherAccountId).to.eq(ZERO_BI);
      expect(depositAction.data).to.eq(BYTES_EMPTY);
    });
  });

  describe('#encodeExpirationAction', () => {
    it('should work normally', async () => {
      const accountId = '123';
      const expiryTimeDelta = '3600';
      const callData = abiCoder.encode(
        ['uint8', '((address,uint256),uint256,uint32,bool)[]'],
        [
          ExpiryCallFunctionType.SetExpiry,
          [[[core.hhUser1.address, defaultAccountNumber], underlyingMarketId, expiryTimeDelta, true]],
        ],
      );
      const callAction = await testLib.connect(core.hhUser1).encodeExpirationAction(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        accountId,
        underlyingMarketId,
        core.expiry.address,
        expiryTimeDelta,
      );
      expect(callAction.actionType).to.eq(ActionType.Call);
      expect(callAction.accountId).to.eq(accountId);
      expectAssetAmountToEq(callAction.amount, defaultAmountStruct);
      expect(callAction.primaryMarketId).to.eq(ZERO_BI);
      expect(callAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(callAction.otherAddress).to.eq(core.expiry.address);
      expect(callAction.otherAccountId).to.eq(ZERO_BI);
      expect(callAction.data).to.eq(callData);
    });

    it('should fail when expiry time delta is too big', async () => {
      const accountId = '123';
      const expiryTimeDelta = '12312312312312312312323';
      await expectThrow(
        testLib.connect(core.hhUser1).encodeExpirationAction(
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          accountId,
          underlyingMarketId,
          core.expiry.address,
          expiryTimeDelta,
        ),
        'AccountActionLib: Invalid expiry time delta',
      );
    });
  });

  describe('#encodeExpiryLiquidateAction', () => {
    it('should work normally', async () => {
      const solidAccountId = '1';
      const liquidAccountId = '9';
      const owedMarketId = underlyingMarketId;
      const heldMarketId = otherMarketId;
      const expiry = '1900000000';
      const callData = abiCoder.encode(
        ['uint256', 'uint32'],
        [owedMarketId, expiry],
      );
      const expireAction = await testLib.connect(core.hhUser1).encodeExpiryLiquidateAction(
        solidAccountId,
        liquidAccountId,
        owedMarketId,
        heldMarketId,
        core.expiry.address,
        expiry,
        false,
      );
      expect(expireAction.actionType).to.eq(ActionType.Trade);
      expect(expireAction.accountId).to.eq(solidAccountId);
      expectAssetAmountToEq(expireAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Target,
        value: ZERO_BI,
      });
      expect(expireAction.primaryMarketId).to.eq(owedMarketId);
      expect(expireAction.secondaryMarketId).to.eq(heldMarketId);
      expect(expireAction.otherAddress).to.eq(core.expiry.address);
      expect(expireAction.otherAccountId).to.eq(liquidAccountId);
      expect(expireAction.data).to.eq(callData);
    });

    it('should work when markets are flipped', async () => {
      const solidAccountId = '1';
      const liquidAccountId = '9';
      const owedMarketId = underlyingMarketId;
      const heldMarketId = otherMarketId;
      const expiry = '1900000000';
      const callData = abiCoder.encode(
        ['uint256', 'uint32'],
        [owedMarketId, expiry],
      );
      const expireAction = await testLib.connect(core.hhUser1).encodeExpiryLiquidateAction(
        solidAccountId,
        liquidAccountId,
        owedMarketId,
        heldMarketId,
        core.expiry.address,
        expiry,
        true,
      );
      expect(expireAction.actionType).to.eq(ActionType.Trade);
      expect(expireAction.accountId).to.eq(solidAccountId);
      expectAssetAmountToEq(expireAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Target,
        value: ZERO_BI,
      });
      expect(expireAction.primaryMarketId).to.eq(heldMarketId);
      expect(expireAction.secondaryMarketId).to.eq(owedMarketId);
      expect(expireAction.otherAddress).to.eq(core.expiry.address);
      expect(expireAction.otherAccountId).to.eq(liquidAccountId);
      expect(expireAction.data).to.eq(callData);
    });
  });

  describe('#encodeInternalTradeAction', () => {
    it('should work normally on Arbitrum', async () => {
      const fromAccountId = '1';
      const toAccountId = '9';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = amountWei;
      const callData = abiCoder.encode(
        ['uint256'],
        [amountWeiBig],
      );
      const tradeAction = await testLib.connect(core.hhUser1).encodeInternalTradeAction(
        fromAccountId,
        toAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        amountInWei,
        Network.ArbitrumOne,
        true,
        callData,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Trade);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountInWei,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(toAccountId);
      expect(tradeAction.data).to.eq(callData);
    });

    it('should work normally on Base', async () => {
      const fromAccountId = '1';
      const toAccountId = '9';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = amountWei;
      const callData = abiCoder.encode(
        ['uint256'],
        [amountWeiBig],
      );
      const calculateAmountWithMaker = true;
      const tradeAction = await testLib.connect(core.hhUser1).encodeInternalTradeAction(
        fromAccountId,
        toAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        amountInWei,
        Network.Base,
        calculateAmountWithMaker,
        callData,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Trade);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountInWei,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(toAccountId);
      expect(tradeAction.data).to.eq(abiCoder.encode(['bool', 'bytes'], [calculateAmountWithMaker, callData]));
    });

    it('should work normally on ZkEVM', async () => {
      const fromAccountId = '1';
      const toAccountId = '9';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = amountWei;
      const callData = abiCoder.encode(
        ['uint256'],
        [amountWeiBig],
      );
      const calculateAmountWithMaker = false;
      const tradeAction = await testLib.connect(core.hhUser1).encodeInternalTradeAction(
        fromAccountId,
        toAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        amountInWei,
        Network.PolygonZkEvm,
        calculateAmountWithMaker,
        callData,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Trade);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountInWei,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(toAccountId);
      expect(tradeAction.data).to.eq(abiCoder.encode(['bool', 'bytes'], [calculateAmountWithMaker, callData]));
    });
  });

  describe('#encodeLiquidateAction', () => {
    it('should work normally', async () => {
      const solidAccountId = '1';
      const liquidAccountId = '9';
      const owedMarketId = underlyingMarketId;
      const heldMarketId = otherMarketId;
      const owedWeiToLiquidate = '421421';
      const liquidateAction = await testLib.connect(core.hhUser1).encodeLiquidateAction(
        solidAccountId,
        liquidAccountId,
        owedMarketId,
        heldMarketId,
        owedWeiToLiquidate,
      );
      expect(liquidateAction.actionType).to.eq(ActionType.Liquidate);
      expect(liquidateAction.accountId).to.eq(solidAccountId);
      expectAssetAmountToEq(liquidateAction.amount, {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: owedWeiToLiquidate,
      });
      expect(liquidateAction.primaryMarketId).to.eq(owedMarketId);
      expect(liquidateAction.secondaryMarketId).to.eq(heldMarketId);
      expect(liquidateAction.otherAddress).to.eq(ZERO_ADDRESS);
      expect(liquidateAction.otherAccountId).to.eq(liquidAccountId);
      expect(liquidateAction.data).to.eq(BYTES_EMPTY);
    });
  });

  describe('#encodeExternalSellAction', () => {
    it('should work normally', async () => {
      const fromAccountId = '1';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = amountWei;
      const amountOutMinWei = amountWeiBig;
      const callData = abiCoder.encode(
        ['uint256', 'bytes'],
        [amountOutMinWei, BYTES_EMPTY],
      );
      const tradeAction = await testLib.connect(core.hhUser1).encodeExternalSellAction(
        fromAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        amountInWei,
        amountOutMinWei,
        BYTES_EMPTY,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Sell);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountInWei,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(0);
      expect(tradeAction.data).to.eq(callData);
    });

    it('should work when amountInWei equals ALL', async () => {
      const fromAccountId = '1';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = ethers.constants.MaxUint256;
      const amountOutMinWei = amountWeiBig;
      const callData = abiCoder.encode(
        ['uint256', 'bytes'],
        [amountOutMinWei, BYTES_EMPTY],
      );
      const tradeAction = await testLib.connect(core.hhUser1).encodeExternalSellAction(
        fromAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        amountInWei,
        amountOutMinWei,
        BYTES_EMPTY,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Sell);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Target,
        value: ZERO_BI,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(0);
      expect(tradeAction.data).to.eq(callData);
    });
  });

  describe('#encodeExternalSellActionWithTarget', () => {
    it('should work normally', async () => {
      const fromAccountId = '1';
      const primaryMarketId = underlyingMarketId;
      const secondaryMarketId = otherMarketId;
      const amountInWei = amountWei;
      const amountOutMinWei = amountWeiBig;
      const callData = abiCoder.encode(
        ['uint256', 'bytes'],
        [amountOutMinWei, BYTES_EMPTY],
      );
      const tradeAction = await testLib.connect(core.hhUser1).encodeExternalSellActionWithTarget(
        fromAccountId,
        primaryMarketId,
        secondaryMarketId,
        core.expiry.address,
        ZERO_BI,
        amountOutMinWei,
        BYTES_EMPTY,
      );
      expect(tradeAction.actionType).to.eq(ActionType.Sell);
      expect(tradeAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(tradeAction.amount, {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Target,
        value: ZERO_BI,
      });
      expect(tradeAction.primaryMarketId).to.eq(primaryMarketId);
      expect(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
      expect(tradeAction.otherAddress).to.eq(core.expiry.address);
      expect(tradeAction.otherAccountId).to.eq(0);
      expect(tradeAction.data).to.eq(callData);
    });
  });

  describe('#encodeTransferAction', () => {
    it('should work normally', async () => {
      const fromAccountId = '1';
      const toAccountId = '9';
      const marketId = underlyingMarketId;
      const transferAction = await testLib.connect(core.hhUser1).encodeTransferAction(
        fromAccountId,
        toAccountId,
        marketId,
        AmountDenomination.Wei,
        amountWei,
      );
      expect(transferAction.actionType).to.eq(ActionType.Transfer);
      expect(transferAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(transferAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountWei,
      });
      expect(transferAction.primaryMarketId).to.eq(marketId);
      expect(transferAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(transferAction.otherAddress).to.eq(ZERO_ADDRESS);
      expect(transferAction.otherAccountId).to.eq(toAccountId);
      expect(transferAction.data).to.eq(BYTES_EMPTY);
    });

    it('should work when amountInWei equals ALL', async () => {
      const fromAccountId = '1';
      const toAccountId = '9';
      const marketId = underlyingMarketId;
      const transferAction = await testLib.connect(core.hhUser1).encodeTransferAction(
        fromAccountId,
        toAccountId,
        marketId,
        AmountDenomination.Wei,
        ethers.constants.MaxUint256,
      );
      expect(transferAction.actionType).to.eq(ActionType.Transfer);
      expect(transferAction.accountId).to.eq(fromAccountId);
      expectAssetAmountToEq(transferAction.amount, {
        sign: false,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Target,
        value: ZERO_BI,
      });
      expect(transferAction.primaryMarketId).to.eq(marketId);
      expect(transferAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(transferAction.otherAddress).to.eq(ZERO_ADDRESS);
      expect(transferAction.otherAccountId).to.eq(toAccountId);
      expect(transferAction.data).to.eq(BYTES_EMPTY);
    });
  });

  describe('#encodeWithdrawalAction', () => {
    it('should work normally', async () => {
      const accountId = '123';
      const toAddress = core.hhUser1.address;
      const amountStruct = {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountWeiBig,
      };
      const withdrawalAction = await testLib.connect(core.hhUser1).encodeWithdrawalAction(
        accountId,
        underlyingMarketId,
        amountStruct,
        toAddress,
      );
      expect(withdrawalAction.actionType).to.eq(ActionType.Withdraw);
      expect(withdrawalAction.accountId).to.eq(accountId);
      expectAssetAmountToEq(withdrawalAction.amount, amountStruct);
      expect(withdrawalAction.primaryMarketId).to.eq(underlyingMarketId);
      expect(withdrawalAction.secondaryMarketId).to.eq(ZERO_BI);
      expect(withdrawalAction.otherAddress).to.eq(toAddress);
      expect(withdrawalAction.otherAccountId).to.eq(ZERO_BI);
      expect(withdrawalAction.data).to.eq(BYTES_EMPTY);
    });
  });

  describe('#all', () => {
    it('should work normally', async () => {
      expect(await testLib.connect(core.hhUser1).all()).to.eq(ethers.constants.MaxUint256);
    });
  });
});

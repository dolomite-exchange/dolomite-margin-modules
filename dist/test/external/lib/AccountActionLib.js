"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const setup_1 = require("../../utils/setup");
const amountWei = ethers_1.BigNumber.from('200000000');
const amountWeiBig = ethers_1.BigNumber.from('500000000');
const defaultAccountNumber = ethers_1.BigNumber.from('0');
const otherAccountNumber = ethers_1.BigNumber.from('123');
const defaultAmountStruct = {
    sign: false,
    denomination: src_1.AmountDenomination.Wei,
    ref: src_1.AmountReference.Delta,
    value: no_deps_constants_1.ZERO_BI,
};
describe('AccountActionLib', () => {
    let snapshotId;
    let core;
    let testLib;
    let underlyingToken;
    let underlyingMarketId;
    let otherToken;
    let otherMarketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        testLib = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestAccountActionLib__factory.abi, types_1.TestAccountActionLib__factory.bytecode, [core.dolomiteMargin.address]);
        await core.dolomiteMargin.ownerSetGlobalOperator(testLib.address, true);
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(underlyingToken.address, '1000000000000000000');
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, underlyingToken, false);
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000');
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        await underlyingToken.connect(core.hhUser1).addBalance(core.dolomiteMargin.address, amountWeiBig);
        await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
        await underlyingToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
        await otherToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWeiBig);
        await otherToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWeiBig);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    async function performDeposit(marketId, amountWei) {
        await testLib.connect(core.hhUser1).deposit(core.hhUser1.address, core.hhUser1.address, defaultAccountNumber, marketId, { sign: true, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei });
        await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, marketId, amountWei);
        await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
    }
    describe('#deposit', () => {
        it('should work normally', async () => {
            await testLib.connect(core.hhUser1).deposit(core.hhUser1.address, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, { sign: true, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei });
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
        });
    });
    describe('#withdraw', () => {
        it('should work normally when flag is set to Both', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
        });
        it('should work normally when flag is set to From', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.From);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
        });
        it('should work normally when flag is set to To', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.To);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
        });
        it('should work normally when flag is set to None', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWei, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.None);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
        });
        it('should fail normally when flag is set to Both/From and account goes negative', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await performDeposit(otherMarketId, amountWeiBig);
            await (0, assertions_1.expectThrowBalanceFlagError)(testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWeiBig, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.Both), core.hhUser1, defaultAccountNumber, underlyingMarketId);
            await (0, assertions_1.expectThrowBalanceFlagError)(testLib.connect(core.hhUser1).withdraw(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, underlyingMarketId, { sign: false, value: amountWeiBig, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Wei }, src_1.BalanceCheckFlag.From), core.hhUser1, defaultAccountNumber, underlyingMarketId);
        });
    });
    describe('#transfer', () => {
        it('should work normally when flag is set to Both', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
        });
        it('should work normally when flag is set to From', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
        });
        it('should work normally when flag is set to To', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
        });
        it('should work normally when flag is set to None', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
        });
        it('should fail normally when flag is set to Both/From/To and account goes negative', async () => {
            await performDeposit(underlyingMarketId, amountWei);
            await performDeposit(otherMarketId, amountWeiBig);
            await (0, assertions_1.expectThrowBalanceFlagError)(testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWeiBig, src_1.BalanceCheckFlag.Both), core.hhUser1, defaultAccountNumber, underlyingMarketId);
            await (0, assertions_1.expectThrowBalanceFlagError)(testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWeiBig, src_1.BalanceCheckFlag.From), core.hhUser1, defaultAccountNumber, underlyingMarketId);
            await testLib.connect(core.hhUser1).transfer(core.hhUser1.address, defaultAccountNumber, core.hhUser1.address, otherAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWeiBig, src_1.BalanceCheckFlag.None);
            await (0, assertions_1.expectThrowBalanceFlagError)(testLib.connect(core.hhUser1).transfer(core.hhUser1.address, otherAccountNumber, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, src_1.AmountDenomination.Wei, amountWei, src_1.BalanceCheckFlag.To), core.hhUser1, defaultAccountNumber, underlyingMarketId);
        });
    });
    describe('#encodeCallAction', () => {
        it('should work normally', async () => {
            const accountId = '123';
            const callData = '0x123321';
            const callAction = await testLib.connect(core.hhUser1).encodeCallAction(accountId, core.dolomiteAmmRouterProxy.address, callData);
            (0, chai_1.expect)(callAction.actionType).to.eq(src_1.ActionType.Call);
            (0, chai_1.expect)(callAction.accountId).to.eq(accountId);
            (0, assertions_1.expectAssetAmountToEq)(callAction.amount, defaultAmountStruct);
            (0, chai_1.expect)(callAction.primaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.otherAddress).to.eq(core.dolomiteAmmRouterProxy.address);
            (0, chai_1.expect)(callAction.otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.data).to.eq(callData);
        });
    });
    describe('#encodeDepositAction', () => {
        it('should work normally', async () => {
            const accountId = '123';
            const amountStruct = {
                sign: true,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: amountWeiBig,
            };
            const depositAction = await testLib.connect(core.hhUser1).encodeDepositAction(accountId, underlyingMarketId, amountStruct, core.hhUser1.address);
            (0, chai_1.expect)(depositAction.actionType).to.eq(src_1.ActionType.Deposit);
            (0, chai_1.expect)(depositAction.accountId).to.eq(accountId);
            (0, assertions_1.expectAssetAmountToEq)(depositAction.amount, amountStruct);
            (0, chai_1.expect)(depositAction.primaryMarketId).to.eq(underlyingMarketId);
            (0, chai_1.expect)(depositAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(depositAction.otherAddress).to.eq(core.hhUser1.address);
            (0, chai_1.expect)(depositAction.otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(depositAction.data).to.eq(no_deps_constants_1.BYTES_EMPTY);
        });
    });
    describe('#encodeExpirationAction', () => {
        it('should work normally', async () => {
            const accountId = '123';
            const expiryTimeDelta = '3600';
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint8', '((address,uint256),uint256,uint32,bool)[]'], [
                src_1.ExpiryCallFunctionType.SetExpiry,
                [[[core.hhUser1.address, defaultAccountNumber], underlyingMarketId, expiryTimeDelta, true]],
            ]);
            const callAction = await testLib.connect(core.hhUser1).encodeExpirationAction({ owner: core.hhUser1.address, number: defaultAccountNumber }, accountId, underlyingMarketId, core.expiry.address, expiryTimeDelta);
            (0, chai_1.expect)(callAction.actionType).to.eq(src_1.ActionType.Call);
            (0, chai_1.expect)(callAction.accountId).to.eq(accountId);
            (0, assertions_1.expectAssetAmountToEq)(callAction.amount, defaultAmountStruct);
            (0, chai_1.expect)(callAction.primaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.otherAddress).to.eq(core.expiry.address);
            (0, chai_1.expect)(callAction.otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(callAction.data).to.eq(callData);
        });
        it('should fail when expiry time delta is too big', async () => {
            const accountId = '123';
            const expiryTimeDelta = '12312312312312312312323';
            await (0, assertions_1.expectThrow)(testLib.connect(core.hhUser1).encodeExpirationAction({ owner: core.hhUser1.address, number: defaultAccountNumber }, accountId, underlyingMarketId, core.expiry.address, expiryTimeDelta), 'AccountActionLib: invalid expiry time');
        });
    });
    describe('#encodeExpiryLiquidateAction', () => {
        it('should work normally', async () => {
            const solidAccountId = '1';
            const liquidAccountId = '9';
            const owedMarketId = underlyingMarketId;
            const heldMarketId = otherMarketId;
            const expiry = '1900000000';
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint32'], [owedMarketId, expiry]);
            const expireAction = await testLib.connect(core.hhUser1).encodeExpiryLiquidateAction(solidAccountId, liquidAccountId, owedMarketId, heldMarketId, core.expiry.address, expiry, false);
            (0, chai_1.expect)(expireAction.actionType).to.eq(src_1.ActionType.Trade);
            (0, chai_1.expect)(expireAction.accountId).to.eq(solidAccountId);
            (0, assertions_1.expectAssetAmountToEq)(expireAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Target,
                value: no_deps_constants_1.ZERO_BI,
            });
            (0, chai_1.expect)(expireAction.primaryMarketId).to.eq(owedMarketId);
            (0, chai_1.expect)(expireAction.secondaryMarketId).to.eq(heldMarketId);
            (0, chai_1.expect)(expireAction.otherAddress).to.eq(core.expiry.address);
            (0, chai_1.expect)(expireAction.otherAccountId).to.eq(liquidAccountId);
            (0, chai_1.expect)(expireAction.data).to.eq(callData);
        });
        it('should work when markets are flipped', async () => {
            const solidAccountId = '1';
            const liquidAccountId = '9';
            const owedMarketId = underlyingMarketId;
            const heldMarketId = otherMarketId;
            const expiry = '1900000000';
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint32'], [owedMarketId, expiry]);
            const expireAction = await testLib.connect(core.hhUser1).encodeExpiryLiquidateAction(solidAccountId, liquidAccountId, owedMarketId, heldMarketId, core.expiry.address, expiry, true);
            (0, chai_1.expect)(expireAction.actionType).to.eq(src_1.ActionType.Trade);
            (0, chai_1.expect)(expireAction.accountId).to.eq(solidAccountId);
            (0, assertions_1.expectAssetAmountToEq)(expireAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Target,
                value: no_deps_constants_1.ZERO_BI,
            });
            (0, chai_1.expect)(expireAction.primaryMarketId).to.eq(heldMarketId);
            (0, chai_1.expect)(expireAction.secondaryMarketId).to.eq(owedMarketId);
            (0, chai_1.expect)(expireAction.otherAddress).to.eq(core.expiry.address);
            (0, chai_1.expect)(expireAction.otherAccountId).to.eq(liquidAccountId);
            (0, chai_1.expect)(expireAction.data).to.eq(callData);
        });
    });
    describe('#encodeInternalTradeAction', () => {
        it('should work normally', async () => {
            const fromAccountId = '1';
            const toAccountId = '9';
            const primaryMarketId = underlyingMarketId;
            const secondaryMarketId = otherMarketId;
            const amountInWei = amountWei;
            const amountOutWei = amountWeiBig;
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [amountOutWei]);
            const tradeAction = await testLib.connect(core.hhUser1).encodeInternalTradeAction(fromAccountId, toAccountId, primaryMarketId, secondaryMarketId, core.dolomiteAmmRouterProxy.address, amountInWei, amountOutWei);
            (0, chai_1.expect)(tradeAction.actionType).to.eq(src_1.ActionType.Trade);
            (0, chai_1.expect)(tradeAction.accountId).to.eq(fromAccountId);
            (0, assertions_1.expectAssetAmountToEq)(tradeAction.amount, {
                sign: true,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: amountInWei,
            });
            (0, chai_1.expect)(tradeAction.primaryMarketId).to.eq(primaryMarketId);
            (0, chai_1.expect)(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
            (0, chai_1.expect)(tradeAction.otherAddress).to.eq(core.dolomiteAmmRouterProxy.address);
            (0, chai_1.expect)(tradeAction.otherAccountId).to.eq(toAccountId);
            (0, chai_1.expect)(tradeAction.data).to.eq(callData);
        });
    });
    describe('#encodeLiquidateAction', () => {
        it('should work normally', async () => {
            const solidAccountId = '1';
            const liquidAccountId = '9';
            const owedMarketId = underlyingMarketId;
            const heldMarketId = otherMarketId;
            const owedWeiToLiquidate = '421421';
            const liquidateAction = await testLib.connect(core.hhUser1).encodeLiquidateAction(solidAccountId, liquidAccountId, owedMarketId, heldMarketId, owedWeiToLiquidate);
            (0, chai_1.expect)(liquidateAction.actionType).to.eq(src_1.ActionType.Liquidate);
            (0, chai_1.expect)(liquidateAction.accountId).to.eq(solidAccountId);
            (0, assertions_1.expectAssetAmountToEq)(liquidateAction.amount, {
                sign: true,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: owedWeiToLiquidate,
            });
            (0, chai_1.expect)(liquidateAction.primaryMarketId).to.eq(owedMarketId);
            (0, chai_1.expect)(liquidateAction.secondaryMarketId).to.eq(heldMarketId);
            (0, chai_1.expect)(liquidateAction.otherAddress).to.eq(Addresses_1.ZERO_ADDRESS);
            (0, chai_1.expect)(liquidateAction.otherAccountId).to.eq(liquidAccountId);
            (0, chai_1.expect)(liquidateAction.data).to.eq(no_deps_constants_1.BYTES_EMPTY);
        });
    });
    describe('#encodeExternalSellAction', () => {
        it('should work normally', async () => {
            const fromAccountId = '1';
            const primaryMarketId = underlyingMarketId;
            const secondaryMarketId = otherMarketId;
            const amountInWei = amountWei;
            const amountOutMinWei = amountWeiBig;
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [amountOutMinWei, no_deps_constants_1.BYTES_EMPTY]);
            const tradeAction = await testLib.connect(core.hhUser1).encodeExternalSellAction(fromAccountId, primaryMarketId, secondaryMarketId, core.dolomiteAmmRouterProxy.address, amountInWei, amountOutMinWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(tradeAction.actionType).to.eq(src_1.ActionType.Sell);
            (0, chai_1.expect)(tradeAction.accountId).to.eq(fromAccountId);
            (0, assertions_1.expectAssetAmountToEq)(tradeAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: amountInWei,
            });
            (0, chai_1.expect)(tradeAction.primaryMarketId).to.eq(primaryMarketId);
            (0, chai_1.expect)(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
            (0, chai_1.expect)(tradeAction.otherAddress).to.eq(core.dolomiteAmmRouterProxy.address);
            (0, chai_1.expect)(tradeAction.otherAccountId).to.eq(0);
            (0, chai_1.expect)(tradeAction.data).to.eq(callData);
        });
        it('should work when amountInWei equals ALL', async () => {
            const fromAccountId = '1';
            const primaryMarketId = underlyingMarketId;
            const secondaryMarketId = otherMarketId;
            const amountInWei = ethers_1.ethers.constants.MaxUint256;
            const amountOutMinWei = amountWeiBig;
            const callData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [amountOutMinWei, no_deps_constants_1.BYTES_EMPTY]);
            const tradeAction = await testLib.connect(core.hhUser1).encodeExternalSellAction(fromAccountId, primaryMarketId, secondaryMarketId, core.dolomiteAmmRouterProxy.address, amountInWei, amountOutMinWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(tradeAction.actionType).to.eq(src_1.ActionType.Sell);
            (0, chai_1.expect)(tradeAction.accountId).to.eq(fromAccountId);
            (0, assertions_1.expectAssetAmountToEq)(tradeAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Target,
                value: no_deps_constants_1.ZERO_BI,
            });
            (0, chai_1.expect)(tradeAction.primaryMarketId).to.eq(primaryMarketId);
            (0, chai_1.expect)(tradeAction.secondaryMarketId).to.eq(secondaryMarketId);
            (0, chai_1.expect)(tradeAction.otherAddress).to.eq(core.dolomiteAmmRouterProxy.address);
            (0, chai_1.expect)(tradeAction.otherAccountId).to.eq(0);
            (0, chai_1.expect)(tradeAction.data).to.eq(callData);
        });
    });
    describe('#encodeTransferAction', () => {
        it('should work normally', async () => {
            const fromAccountId = '1';
            const toAccountId = '9';
            const marketId = underlyingMarketId;
            const transferAction = await testLib.connect(core.hhUser1).encodeTransferAction(fromAccountId, toAccountId, marketId, src_1.AmountDenomination.Wei, amountWei);
            (0, chai_1.expect)(transferAction.actionType).to.eq(src_1.ActionType.Transfer);
            (0, chai_1.expect)(transferAction.accountId).to.eq(fromAccountId);
            (0, assertions_1.expectAssetAmountToEq)(transferAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: amountWei,
            });
            (0, chai_1.expect)(transferAction.primaryMarketId).to.eq(marketId);
            (0, chai_1.expect)(transferAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(transferAction.otherAddress).to.eq(Addresses_1.ZERO_ADDRESS);
            (0, chai_1.expect)(transferAction.otherAccountId).to.eq(toAccountId);
            (0, chai_1.expect)(transferAction.data).to.eq(no_deps_constants_1.BYTES_EMPTY);
        });
        it('should work when amountInWei equals ALL', async () => {
            const fromAccountId = '1';
            const toAccountId = '9';
            const marketId = underlyingMarketId;
            const transferAction = await testLib.connect(core.hhUser1).encodeTransferAction(fromAccountId, toAccountId, marketId, src_1.AmountDenomination.Wei, ethers_1.ethers.constants.MaxUint256);
            (0, chai_1.expect)(transferAction.actionType).to.eq(src_1.ActionType.Transfer);
            (0, chai_1.expect)(transferAction.accountId).to.eq(fromAccountId);
            (0, assertions_1.expectAssetAmountToEq)(transferAction.amount, {
                sign: false,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Target,
                value: no_deps_constants_1.ZERO_BI,
            });
            (0, chai_1.expect)(transferAction.primaryMarketId).to.eq(marketId);
            (0, chai_1.expect)(transferAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(transferAction.otherAddress).to.eq(Addresses_1.ZERO_ADDRESS);
            (0, chai_1.expect)(transferAction.otherAccountId).to.eq(toAccountId);
            (0, chai_1.expect)(transferAction.data).to.eq(no_deps_constants_1.BYTES_EMPTY);
        });
    });
    describe('#encodeWithdrawalAction', () => {
        it('should work normally', async () => {
            const accountId = '123';
            const toAddress = core.hhUser1.address;
            const amountStruct = {
                sign: true,
                denomination: src_1.AmountDenomination.Wei,
                ref: src_1.AmountReference.Delta,
                value: amountWeiBig,
            };
            const withdrawalAction = await testLib.connect(core.hhUser1).encodeWithdrawalAction(accountId, underlyingMarketId, amountStruct, toAddress);
            (0, chai_1.expect)(withdrawalAction.actionType).to.eq(src_1.ActionType.Withdraw);
            (0, chai_1.expect)(withdrawalAction.accountId).to.eq(accountId);
            (0, assertions_1.expectAssetAmountToEq)(withdrawalAction.amount, amountStruct);
            (0, chai_1.expect)(withdrawalAction.primaryMarketId).to.eq(underlyingMarketId);
            (0, chai_1.expect)(withdrawalAction.secondaryMarketId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(withdrawalAction.otherAddress).to.eq(toAddress);
            (0, chai_1.expect)(withdrawalAction.otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(withdrawalAction.data).to.eq(no_deps_constants_1.BYTES_EMPTY);
        });
    });
    describe('#all', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await testLib.connect(core.hhUser1).all()).to.eq(ethers_1.ethers.constants.MaxUint256);
        });
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_2 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const setup_1 = require("../../../utils/setup");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('IsolationModeUnwrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let otherToken;
    let otherMarketId;
    let unwrapper;
    let factory;
    let vault;
    let defaultAccount;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        const userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1__factory.abi, types_1.TestIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeFactory__factory.abi, types_1.TestIsolationModeFactory__factory.bytecode, [
            underlyingToken.address,
            core.borrowPositionProxyV2.address,
            userVaultImplementation.address,
            core.dolomiteMargin.address,
        ]);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000'); // $1.00
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true);
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000'); // $1.00
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, true);
        unwrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTraderV2__factory.abi, types_1.TestIsolationModeUnwrapperTraderV2__factory.bytecode, [otherToken.address, factory.address, core.dolomiteMargin.address]);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
        await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);
        snapshotId = await (0, utils_2.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_2.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Call and Exchange for non-liquidation sale', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await unwrapper.createActionsForUnwrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, otherMarketId, underlyingMarketId, no_deps_constants_1.ZERO_BI, amountWei, no_deps_constants_1.BYTES_EMPTY);
            const amountOut = await unwrapper.getExchangeCost(factory.address, otherToken.address, amountWei, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, otherMarketId);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(amountOut);
        });
    });
    describe('#callFunction', () => {
        it('should work if invoked properly', async () => {
            const dolomiteMarginCaller = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await unwrapper.connect(dolomiteMarginCaller).callFunction(core.hhUser5.address, { owner: vault.address, number: defaultAccountNumber }, utils_1.defaultAbiCoder.encode(['uint256'], [amountWei]));
            const cursor = await factory.transferCursor();
            (0, chai_1.expect)(cursor).to.eq(2);
            const transfer = await factory.getQueuedTransferByCursor(cursor);
            (0, chai_1.expect)(transfer.from).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(transfer.to).to.eq(unwrapper.address);
            (0, chai_1.expect)(transfer.amount).to.eq(amountWei);
            (0, chai_1.expect)(transfer.vault).to.eq(vault.address);
        });
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.connect(core.hhUser1).callFunction(core.hhUser1.address, defaultAccount, utils_1.defaultAbiCoder.encode(['uint256'], [amountWei])), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if sender param is not a global operator', async () => {
            const dolomiteMarginCaller = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginCaller).callFunction(core.hhUser1.address, defaultAccount, utils_1.defaultAbiCoder.encode(['uint256'], [amountWei])), `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if account.owner param is not a vault', async () => {
            const dolomiteMarginCaller = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginCaller).callFunction(core.hhUser5.address, { owner: core.hhUser1.address, number: defaultAccountNumber }, utils_1.defaultAbiCoder.encode(['uint256'], [amountWei])), `IsolationModeUnwrapperTraderV2: Account owner is not a vault <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if transferAmount param is 0', async () => {
            const dolomiteMarginCaller = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginCaller).callFunction(core.hhUser5.address, { owner: vault.address, number: defaultAccountNumber }, utils_1.defaultAbiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), 'IsolationModeUnwrapperTraderV2: Invalid transfer amount');
        });
        it('should fail if vault underlying balance is less than the transfer amount (ISF)', async () => {
            const dolomiteMarginCaller = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginCaller).callFunction(core.hhUser5.address, { owner: vault.address, number: defaultAccountNumber }, utils_1.defaultAbiCoder.encode(['uint256'], [amountWei.mul(111)])), `IsolationModeUnwrapperTraderV2: Insufficient balance <${amountWei.toString()}, ${amountWei.mul(111)
                .toString()}>`);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, factory.address, otherToken.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, factory.address, core.tokens.weth.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if there is an insufficient input token balance', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, otherToken.address, factory.address, amountWei, abiCoder.encode(['uint256', 'bytes'], [amountWei, no_deps_constants_1.BYTES_EMPTY])), `IsolationModeUnwrapperTraderV2: Insufficient input token <0, ${amountWei.toString()}>`);
        });
        it('should fail if there is an insufficient amount outputted', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            const unwrapperImpersonator = await (0, utils_2.impersonate)(unwrapper.address, true);
            await factory.connect(unwrapperImpersonator).enqueueTransferFromDolomiteMargin(vault.address, amountWei);
            await factory.connect(dolomiteMarginImpersonator).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, otherToken.address, factory.address, amountWei, abiCoder.encode(['uint256', 'bytes'], [amountWei.mul(2), no_deps_constants_1.BYTES_EMPTY])), `IsolationModeUnwrapperTraderV2: Insufficient output amount <${amountWei.toString()}, ${amountWei.mul(2)
                .toString()}>`);
        });
    });
    describe('#token', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.token()).to.eq(factory.address);
        });
    });
    describe('#isValidOutputToken', () => {
        it('should work as expected', async () => {
            (0, chai_1.expect)(await unwrapper.isValidOutputToken(otherToken.address)).to.be.true;
            (0, chai_1.expect)(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.false;
            (0, chai_1.expect)(await unwrapper.isValidOutputToken(core.tokens.usdc.address)).to.be.false;
        });
    });
    describe('#createActionsForUnwrappingForLiquidation', () => {
        it('should work for normal condition', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 1;
            const actions = await unwrapper.createActionsForUnwrapping(solidAccountId, liquidAccountId, solidUser.address, core.hhUser1.address, otherMarketId, underlyingMarketId, otherAmountWei, amountWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(actions.length).to.eq(2);
            // Inspect the call action
            (0, chai_1.expect)(actions[0].actionType).to.eq(src_1.ActionType.Call);
            (0, chai_1.expect)(actions[0].accountId).to.eq(liquidAccountId);
            (0, chai_1.expect)(actions[0].otherAddress).to.eq(unwrapper.address);
            (0, chai_1.expect)(actions[0].data).to.eq(abiCoder.encode(['uint256'], [amountWei]));
            // Inspect the sell action
            (0, chai_1.expect)(actions[1].actionType).to.eq(src_1.ActionType.Sell);
            (0, chai_1.expect)(actions[1].accountId).to.eq(solidAccountId);
            (0, chai_1.expect)(actions[1].amount.sign).to.eq(false);
            (0, chai_1.expect)(actions[1].amount.denomination).to.eq(src_1.AmountDenomination.Wei);
            (0, chai_1.expect)(actions[1].amount.ref).to.eq(src_1.AmountReference.Delta);
            (0, chai_1.expect)(actions[1].amount.value).to.eq(amountWei);
            (0, chai_1.expect)(actions[1].primaryMarketId).to.eq(underlyingMarketId);
            (0, chai_1.expect)(actions[1].secondaryMarketId).to.eq(otherMarketId);
            (0, chai_1.expect)(actions[1].otherAddress).to.eq(unwrapper.address);
            (0, chai_1.expect)(actions[1].otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(actions[1].data).to.eq(abiCoder.encode(['uint', 'bytes'], [otherAmountWei, no_deps_constants_1.BYTES_EMPTY]));
        });
        it('should fail if invalid input token is passed', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.createActionsForUnwrapping(0, 0, solidUser.address, core.hhUser1.address, otherMarketId, core.marketIds.weth, otherAmountWei, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`);
        });
        it('should fail if invalid output token is passed', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.createActionsForUnwrapping(0, 0, solidUser.address, core.hhUser1.address, core.marketIds.weth, underlyingMarketId, otherAmountWei, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`);
        });
    });
    describe('#actionsLength', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.actionsLength()).to.eq(2);
        });
    });
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const outputAmount = await unwrapper.getExchangeCost(factory.address, otherToken.address, amountWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(outputAmount).to.eq(amountWei);
        });
        it('should fail when input token is invalid', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(core.tokens.dfsGlp.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail when output token is invalid', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(factory.address, core.tokens.dfsGlp.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail when input amount is invalid', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(factory.address, otherToken.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), 'IsolationModeUnwrapperTraderV2: Invalid desired input amount');
        });
    });
});

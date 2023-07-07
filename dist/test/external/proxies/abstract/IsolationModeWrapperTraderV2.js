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
const TEN = ethers_1.BigNumber.from('10000000000000000000');
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('IsolationModeWrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let otherToken;
    let otherMarketId;
    let wrapper;
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
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000000000000000'); // $1.00
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        wrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeWrapperTraderV2__factory.abi, types_1.TestIsolationModeWrapperTraderV2__factory.bytecode, [otherToken.address, factory.address, core.dolomiteMargin.address]);
        await factory.connect(core.governance).ownerInitialize([wrapper.address]);
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
        await otherToken.connect(core.hhUser1).addBalance(core.dolomiteMargin.address, amountWei);
        snapshotId = await (0, utils_2.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_2.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('constructor', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.token()).to.eq(factory.address);
            (0, chai_1.expect)(await wrapper.VAULT_FACTORY()).to.eq(factory.address);
            (0, chai_1.expect)(await wrapper.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
        });
    });
    describe('Call and Exchange for non-liquidation sale', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, underlyingMarketId, otherMarketId, no_deps_constants_1.ZERO_BI, otherAmountWei, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(amountWei.add(TEN));
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei.add(TEN));
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, otherMarketId);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(false);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(otherAmountWei);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(wrapper.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, otherToken.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if trade originator is not a vault', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, otherToken.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.weth.address, otherToken.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the output amount is insufficient', async () => {
            const dolomiteMarginImpersonator = await (0, utils_2.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, factory.address, otherToken.address, amountWei.div(1e12), // normalize the amount to match the # of decimals otherToken has
            utils_1.defaultAbiCoder.encode(['uint256', 'bytes'], [amountWei.mul(2), no_deps_constants_1.BYTES_EMPTY])), `IsolationModeWrapperTraderV2: Insufficient output amount <${amountWei.toString()}, ${amountWei.mul(2)
                .toString()}>`);
        });
    });
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const outputAmount = await wrapper.getExchangeCost(otherToken.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(outputAmount).to.eq(amountWei);
        });
        it('should fail when input token is invalid', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(core.tokens.dfsGlp.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail when output token is invalid', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(otherToken.address, core.tokens.dfsGlp.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail when input amount is invalid', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(otherToken.address, factory.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), 'IsolationModeWrapperTraderV2: Invalid desired input amount');
        });
    });
    describe('#actionsLength', () => {
        it('should return the correct amount', async () => {
            (0, chai_1.expect)(await wrapper.actionsLength()).to.eq(1);
        });
    });
    describe('#createActionsForWrapping', () => {
        it('should work for normal condition', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 1;
            const actions = await wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, solidUser.address, core.hhUser1.address, underlyingMarketId, otherMarketId, otherAmountWei, amountWei, no_deps_constants_1.BYTES_EMPTY);
            (0, chai_1.expect)(actions.length).to.eq(1);
            // Inspect the sell action
            (0, chai_1.expect)(actions[0].actionType).to.eq(src_1.ActionType.Sell);
            (0, chai_1.expect)(actions[0].accountId).to.eq(solidAccountId);
            (0, chai_1.expect)(actions[0].amount.sign).to.eq(false);
            (0, chai_1.expect)(actions[0].amount.denomination).to.eq(src_1.AmountDenomination.Wei);
            (0, chai_1.expect)(actions[0].amount.ref).to.eq(src_1.AmountReference.Delta);
            (0, chai_1.expect)(actions[0].amount.value).to.eq(amountWei);
            (0, chai_1.expect)(actions[0].primaryMarketId).to.eq(otherMarketId);
            (0, chai_1.expect)(actions[0].secondaryMarketId).to.eq(underlyingMarketId);
            (0, chai_1.expect)(actions[0].otherAddress).to.eq(wrapper.address);
            (0, chai_1.expect)(actions[0].otherAccountId).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(actions[0].data).to.eq(abiCoder.encode(['uint', 'bytes'], [otherAmountWei, no_deps_constants_1.BYTES_EMPTY]));
        });
        it('should fail when input market is invalid', async () => {
            const solidAccount = 0;
            await (0, assertions_1.expectThrow)(wrapper.createActionsForWrapping(solidAccount, solidAccount, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, underlyingMarketId, core.marketIds.weth, no_deps_constants_1.ZERO_BI, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`);
        });
        it('should fail when output market is invalid', async () => {
            const solidAccount = 0;
            await (0, assertions_1.expectThrow)(wrapper.createActionsForWrapping(solidAccount, solidAccount, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, core.marketIds.weth, otherMarketId, no_deps_constants_1.ZERO_BI, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`);
        });
    });
});

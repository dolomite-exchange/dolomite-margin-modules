"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const ethers_1 = require("ethers");
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const testers_1 = require("../../../utils/ecosystem-token-utils/testers");
const setup_1 = require("../../../utils/setup");
const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const bigOtherAmountWei = ethers_1.BigNumber.from('100000000000'); // $100,000
describe('IsolationModeTokenVaultV1WithPausable', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let tokenUnwrapper;
    let factory;
    let userVaultImplementation;
    let eoaVault;
    let contractVault;
    let doAnything;
    let solidUser;
    let otherToken;
    let otherMarketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory.abi, types_1.TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory.bytecode, []);
        factory = await (0, testers_1.createTestIsolationModeFactory)(core, underlyingToken, userVaultImplementation);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true);
        tokenUnwrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTrader__factory.abi, types_1.TestIsolationModeUnwrapperTrader__factory.bytecode, [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address]);
        await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        doAnything = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestDoAnything__factory.abi, types_1.TestDoAnything__factory.bytecode, []);
        await factory.createVault(core.hhUser1.address);
        await factory.createVault(doAnything.address);
        const eoaVaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        eoaVault = (0, setup_1.setupUserVaultProxy)(eoaVaultAddress, types_1.TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory, core.hhUser1);
        const doAnythingVaultAddress = await factory.getVaultByAccount(doAnything.address);
        contractVault = (0, setup_1.setupUserVaultProxy)(doAnythingVaultAddress, types_1.TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory);
        await eoaVault.initialize();
        await contractVault.connect(core.hhUser1).initialize();
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000000000000000');
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
        await underlyingToken.connect(core.hhUser1).approve(eoaVaultAddress, amountWei);
        await otherToken.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
        await otherToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
        await otherToken.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
        await otherToken.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, solidUser, defaultAccountNumber, otherMarketId, bigOtherAmountWei);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#depositIntoVaultForDolomiteMargin', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should work normally an EOA calls factory for creation', async () => {
            const eoaVaultAddress = await factory.calculateVaultByAccount(core.hhUser4.address);
            await underlyingToken.connect(core.hhUser4).addBalance(core.hhUser4.address, amountWei);
            await underlyingToken.connect(core.hhUser4).approve(eoaVaultAddress, amountWei);
            await factory.connect(core.hhUser4).createVaultAndDepositIntoDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser4, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser4, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVaultAddress, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVaultAddress, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail contract calls factory for creation', async () => {
            const doAnything = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestDoAnything__factory.abi, types_1.TestDoAnything__factory.bytecode, []);
            const transaction = await factory.populateTransaction.createVaultAndDepositIntoDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.connect(core.hhUser4).callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Vault owner is not an EOA <${doAnything.address.toLowerCase()}>`);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Vault owner is not an EOA <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#withdrawFromVaultForDolomiteMargin', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(2));
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei.div(2));
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei.div(2));
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#openBorrowPosition', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await eoaVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#closeBorrowPositionWithOtherTokens', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await eoaVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#transferIntoPositionWithUnderlyingToken', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#transferIntoPositionWithOtherToken', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, otherMarketId, otherAmountWei);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#transferFromPositionWithUnderlyingToken', () => {
        it('should work normally when called by an EOA owner', async () => {
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await eoaVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
    describe('#transferFromPositionWithOtherToken', () => {
        it('should work normally when called by an EOA owner', async () => {
            await factory.setAllowableDebtMarketIds([]);
            await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await eoaVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, otherMarketId, otherAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await eoaVault.setIsExternalRedemptionPaused(true);
            await eoaVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
            await (0, assertions_1.expectProtocolBalance)(core, eoaVault, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
        });
        it('should fail when called by a contract', async () => {
            const transaction = await contractVault.populateTransaction.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
            await (0, assertions_1.expectThrow)(doAnything.callAnything(transaction.to, transaction.data), `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`);
        });
    });
});

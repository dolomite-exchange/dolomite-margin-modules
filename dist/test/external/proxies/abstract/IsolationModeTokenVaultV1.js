"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
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
describe('IsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let tokenUnwrapper;
    let factory;
    let userVaultImplementation;
    let userVault;
    let solidUser;
    let otherToken;
    let otherMarketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1__factory.abi, types_1.TestIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, testers_1.createTestIsolationModeFactory)(core, underlyingToken, userVaultImplementation);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true);
        tokenUnwrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTrader__factory.abi, types_1.TestIsolationModeUnwrapperTrader__factory.bytecode, [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address]);
        await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        userVault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
        await userVault.initialize();
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000000000000000');
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
        await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
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
    describe('basic read functions', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
            (0, chai_1.expect)(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
            (0, chai_1.expect)(await userVault.VAULT_FACTORY()).to.eq(factory.address);
            (0, chai_1.expect)(await userVault.marketId()).to.eq(underlyingMarketId);
        });
    });
    describe('#nonReentrant', () => {
        it('should work when no reentrancy happens', async () => {
            await userVault.testReentrancy(false);
        });
        it('should fail when reentrancy happens', async () => {
            await (0, assertions_1.expectThrow)(userVault.testReentrancy(true), 'IsolationModeTokenVaultV1: Reentrant call');
        });
    });
    describe('#initialize', () => {
        it('should fail when already initialized', async () => {
            await (0, assertions_1.expectThrow)(userVault.initialize(), 'IsolationModeTokenVaultV1: Already initialized');
        });
    });
    describe('#depositIntoVaultForDolomiteMargin', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin, factory, amountWei);
            await (0, assertions_1.expectWalletBalance)(userVault, underlyingToken, amountWei);
            await (0, assertions_1.expectTotalSupply)(factory, amountWei);
        });
        it('should work when interacted with via factory', async () => {
            const factorySigner = await (0, utils_1.impersonate)(factory.address, true);
            await userVault.connect(factorySigner).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin, factory, amountWei);
            await (0, assertions_1.expectWalletBalance)(userVault, underlyingToken, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectTotalSupply)(factory, amountWei);
        });
        it('should fail when toAccountNumber is not 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.depositIntoVaultForDolomiteMargin('1', amountWei), 'IsolationModeTokenVaultV1: Invalid toAccountNumber <1>');
        });
        it('should fail when not sent by vault owner nor factory', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#withdrawFromVaultForDolomiteMargin', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(userVault, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
            await (0, assertions_1.expectTotalSupply)(factory, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when fromAccountNumber is not 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.withdrawFromVaultForDolomiteMargin('1', amountWei), 'IsolationModeTokenVaultV1: Invalid fromAccountNumber <1>');
        });
        it('should fail when not sent by vault owner nor factory', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#openBorrowPosition', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when fromAccountNumber != 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`);
        });
        it('should fail when toAccountNumber == 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid toAccountNumber <${defaultAccountNumber}>`);
        });
    });
    describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2)
                .closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when borrowAccountNumber != 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber), `IsolationModeTokenVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`);
        });
        it('should fail when toAccountNumber == 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, borrowAccountNumber), `IsolationModeTokenVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`);
        });
    });
    describe('#closeBorrowPositionWithOtherTokens', () => {
        it('should work normally', async () => {
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when underlying is requested to be withdrawn', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [underlyingMarketId]), `IsolationModeTokenVaultV1: Cannot withdraw market to wallet <${underlyingMarketId.toString()}>`);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#transferIntoPositionWithUnderlyingToken', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2)
                .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when fromAccountNumber != 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`);
        });
        it('should fail when borrowAccountNumber == 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`);
        });
    });
    describe('#transferIntoPositionWithOtherToken', () => {
        it('should work normally', async () => {
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
        });
        it('should work normally when collateral market is allowed', async () => {
            await factory.setAllowableCollateralMarketIds([otherMarketId]);
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
        });
        it('should work normally for disallowed collateral asset that goes negative (debt market)', async () => {
            await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei.div(2), src_1.BalanceCheckFlag.None);
            // the default account had $10, then added another $10, then lost $5, so it should have $15
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, ethers_1.BigNumber.from('15000000'));
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.div(-2));
        });
        it('should work when non-allowable debt market is transferred in', async () => {
            await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
            // attempt to transfer another market ID in
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when underlying token is used as transfer token', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, underlyingMarketId, amountWei, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`);
        });
        it('should fail when transferring in an unsupported collateral token', async () => {
            await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
            await (0, assertions_1.expectThrow)(userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Market not allowed as collateral <${otherMarketId.toString()}>`);
        });
    });
    describe('#transferFromPositionWithUnderlyingToken', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2)
                .transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when borrowAccountNumber != 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`);
        });
        it('should fail when toAccountNumber == 0', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, borrowAccountNumber, amountWei), `IsolationModeTokenVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`);
        });
    });
    describe('#transferFromPositionWithOtherToken', () => {
        it('should work when no allowable debt market is set (all are allowed then)', async () => {
            await factory.setAllowableDebtMarketIds([]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
        });
        it('should work when 1 allowable debt market is set', async () => {
            await factory.setAllowableDebtMarketIds([otherMarketId]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei.div(2), src_1.BalanceCheckFlag.To);
        });
        it('should work when 1 allowable collateral market is set', async () => {
            await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To);
        });
        it('should work when 1 allowable debt market is set', async () => {
            await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.None);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei.div(2), src_1.BalanceCheckFlag.None);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when not underlying market is used', async () => {
            await (0, assertions_1.expectThrow)(userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, underlyingMarketId, amountWei, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`);
        });
        it('should fail when an invalid debt market is used', async () => {
            await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei, src_1.BalanceCheckFlag.To), `IsolationModeTokenVaultV1: Market not allowed as debt <${otherMarketId}>`);
        });
    });
    describe('#repayAllForBorrowPosition', () => {
        it('should work normally', async () => {
            await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
            await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
            await userVault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, otherMarketId, otherAmountWei.div(2), src_1.BalanceCheckFlag.To);
            await userVault.repayAllForBorrowPosition(defaultAccountNumber, borrowAccountNumber, otherMarketId, src_1.BalanceCheckFlag.Both);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, defaultAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, userVault, borrowAccountNumber, otherMarketId, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser2).repayAllForBorrowPosition(defaultAccountNumber, borrowAccountNumber, otherMarketId, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when underlying market is repaid', async () => {
            await (0, assertions_1.expectThrow)(userVault.repayAllForBorrowPosition(defaultAccountNumber, borrowAccountNumber, underlyingMarketId, src_1.BalanceCheckFlag.Both), `IsolationModeTokenVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`);
        });
    });
    describe('#executeDepositIntoVault', () => {
        it('should fail when not called by factory', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei), `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#executeWithdrawalFromVault', () => {
        it('should fail when not called by factory', async () => {
            await (0, assertions_1.expectThrow)(userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei), `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
});

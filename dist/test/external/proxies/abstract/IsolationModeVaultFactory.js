"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const testers_1 = require("../../../utils/ecosystem-token-utils/testers");
const setup_1 = require("../../../utils/setup");
const toAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // 200 units
const smallAmountWei = ethers_1.BigNumber.from('10000000000000000000'); // 10 units
describe('IsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let otherToken;
    let otherMarketId;
    let rewardToken;
    let rewardMarketId;
    let tokenUnwrapperV1;
    let tokenWrapperV1;
    let tokenUnwrapperV2;
    let tokenWrapperV2;
    let factory;
    let userVaultImplementation;
    let initializeResult;
    let solidAccount;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        otherToken = await (0, dolomite_utils_1.createTestToken)();
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1__factory.abi, types_1.TestIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, testers_1.createTestIsolationModeFactory)(core, underlyingToken, userVaultImplementation);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000');
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true);
        otherMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, otherToken, false);
        rewardToken = await (0, dolomite_utils_1.createTestToken)();
        await core.testPriceOracle.setPrice(rewardToken.address, '1000000000000000000');
        rewardMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, rewardToken, false);
        tokenUnwrapperV1 = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTraderV1__factory.abi, types_1.TestIsolationModeUnwrapperTraderV1__factory.bytecode, [otherToken.address, factory.address, core.dolomiteMargin.address]);
        tokenUnwrapperV2 = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTraderV2__factory.abi, types_1.TestIsolationModeUnwrapperTraderV2__factory.bytecode, [otherToken.address, factory.address, core.dolomiteMargin.address]);
        tokenWrapperV1 = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeWrapperTraderV1__factory.abi, types_1.TestIsolationModeWrapperTraderV1__factory.bytecode, [factory.address, core.dolomiteMargin.address]);
        tokenWrapperV2 = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeWrapperTraderV2__factory.abi, types_1.TestIsolationModeWrapperTraderV2__factory.bytecode, [otherToken.address, factory.address, core.dolomiteMargin.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapperV1.address, true);
        initializeResult = await factory.connect(core.governance).ownerInitialize([
            tokenUnwrapperV1.address,
            tokenWrapperV1.address,
            tokenUnwrapperV2.address,
            tokenWrapperV2.address,
        ]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidAccount = core.hhUser5;
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    async function createUninitializedFactory() {
        return (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeFactory__factory.abi, types_1.TestIsolationModeFactory__factory.bytecode, [
            underlyingToken.address,
            core.borrowPositionProxyV2.address,
            userVaultImplementation.address,
            core.dolomiteMargin.address,
        ]);
    }
    async function checkVaultCreationResults(result) {
        const vault = await factory.getVaultByAccount(core.hhUser1.address);
        const account = await factory.getAccountByVault(vault);
        (0, chai_1.expect)(account).to.eq(core.hhUser1.address);
        await (0, assertions_1.expectEvent)(factory, result, 'VaultCreated', {
            account: core.hhUser1.address,
            vault: vault.toString(),
        });
        await (0, chai_1.expect)(await core.borrowPositionProxyV2.isCallerAuthorized(vault)).to.eq(true);
        const vaultContract = (0, setup_1.setupUserVaultProxy)(vault, types_1.IsolationModeUpgradeableProxy__factory, core.hhUser1);
        (0, chai_1.expect)(await vaultContract.isInitialized()).to.eq(true);
        (0, chai_1.expect)(await vaultContract.owner()).to.eq(core.hhUser1.address);
    }
    describe('#initialize', () => {
        it('should work when deployed normally', async () => {
            await (0, assertions_1.expectEvent)(factory, initializeResult, 'Initialized', {});
            await (0, assertions_1.expectEvent)(factory, initializeResult, 'TokenConverterSet', {
                tokenConverter: tokenUnwrapperV1.address,
                isTrusted: true,
            });
            (0, chai_1.expect)(await factory.marketId()).to.eq(underlyingMarketId);
            (0, chai_1.expect)(await factory.isInitialized()).to.eq(true);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenUnwrapperV1.address)).to.eq(true);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenUnwrapperV2.address)).to.eq(true);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenWrapperV2.address)).to.eq(true);
        });
        it('should fail when already initialized', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.governance).ownerInitialize([]), 'IsolationModeVaultFactory: Already initialized');
        });
        it('should fail when not called by DolomiteMargin owner', async () => {
            const badFactory = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeFactory__factory.abi, types_1.TestIsolationModeFactory__factory.bytecode, [
                underlyingToken.address,
                core.borrowPositionProxyV2.address,
                userVaultImplementation.address,
                core.dolomiteMargin.address,
            ]);
            await core.testPriceOracle.setPrice(badFactory.address, '1000000000000000000');
            await core.dolomiteMargin.connect(core.governance).ownerAddMarket(badFactory.address, core.testPriceOracle.address, core.testInterestSetter.address, { value: 0 }, { value: 0 }, 0, false, false);
            await (0, assertions_1.expectThrow)(badFactory.connect(core.hhUser1).ownerInitialize([]), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when market allows borrowing', async () => {
            const badFactory = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeFactory__factory.abi, types_1.TestIsolationModeFactory__factory.bytecode, [
                underlyingToken.address,
                core.borrowPositionProxyV2.address,
                userVaultImplementation.address,
                core.dolomiteMargin.address,
            ]);
            await core.testPriceOracle.setPrice(badFactory.address, '1000000000000000000');
            await core.dolomiteMargin.connect(core.governance).ownerAddMarket(badFactory.address, core.testPriceOracle.address, core.testInterestSetter.address, { value: 0 }, { value: 0 }, 0, false, false);
            await (0, assertions_1.expectThrow)(badFactory.connect(core.governance).ownerInitialize([]), 'IsolationModeVaultFactory: Market cannot allow borrowing');
        });
    });
    describe('#createVault', () => {
        it('should work under normal conditions', async () => {
            const result = await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            await checkVaultCreationResults(result);
        });
        it('should work when a different wallet creates vault for other', async () => {
            const result = await factory.connect(core.governance).createVault(core.hhUser1.address);
            await checkVaultCreationResults(result);
        });
        it('should fail when account passed is the zero address', async () => {
            await (0, assertions_1.expectThrow)(factory.createVault(Addresses_1.ZERO_ADDRESS), 'IsolationModeVaultFactory: Invalid account');
        });
        it('should fail when vault is already created', async () => {
            const result = await factory.createVault(core.hhUser1.address);
            await checkVaultCreationResults(result);
            await (0, assertions_1.expectThrow)(factory.createVault(core.hhUser1.address), 'IsolationModeVaultFactory: Vault already exists');
        });
        it('should fail when factory is not initialized', async () => {
            const uninitializedFactory = await createUninitializedFactory();
            await (0, assertions_1.expectThrow)(uninitializedFactory.createVault(core.hhUser1.address), 'IsolationModeVaultFactory: Not initialized');
        });
    });
    describe('#createVaultAndDepositIntoDolomiteMargin', () => {
        it('should work under normal conditions', async () => {
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
            const result = await factory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei);
            await checkVaultCreationResults(result);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin.address, factory, amountWei);
        });
        it('should fail when vault is already created', async () => {
            const result = await factory.createVault(core.hhUser1.address);
            await checkVaultCreationResults(result);
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei), 'IsolationModeVaultFactory: Vault already exists');
        });
        it('should fail when factory is not initialized', async () => {
            const uninitializedFactory = await createUninitializedFactory();
            await (0, assertions_1.expectThrow)(uninitializedFactory.connect(core.hhUser1).createVaultAndDepositIntoDolomiteMargin(toAccountNumber, amountWei), 'IsolationModeVaultFactory: Not initialized');
        });
    });
    describe('#ownerSetUserVaultImplementation', () => {
        it('should work when called by governance', async () => {
            const newImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            const result = await factory.connect(core.governance)
                .ownerSetUserVaultImplementation(newImplementation.address);
            (0, chai_1.expect)(await factory.userVaultImplementation()).to.eq(newImplementation.address);
            await (0, assertions_1.expectEvent)(factory, result, 'UserVaultImplementationSet', {
                previousUserVaultImplementation: userVaultImplementation.address,
                newUserVaultImplementation: newImplementation.address,
            });
        });
        it('should fail when not called by owner', async () => {
            const newImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).ownerSetUserVaultImplementation(newImplementation.address), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when not not initialized', async () => {
            const newImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            const uninitializedFactory = await createUninitializedFactory();
            await (0, assertions_1.expectThrow)(uninitializedFactory.ownerSetUserVaultImplementation(newImplementation.address), 'IsolationModeVaultFactory: Not initialized');
        });
        it('should fail when user vault implementation is not valid', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.governance).ownerSetUserVaultImplementation(Addresses_1.ZERO_ADDRESS), 'IsolationModeVaultFactory: Invalid user implementation');
        });
    });
    describe('#ownerSetIsTokenConverterTrusted', () => {
        it('should work when called by governance', async () => {
            const newConverter = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            const result1 = await factory.connect(core.governance)
                .ownerSetIsTokenConverterTrusted(newConverter.address, true);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(true);
            await (0, assertions_1.expectEvent)(factory, result1, 'TokenConverterSet', {
                tokenConverter: newConverter.address,
                isTrusted: true,
            });
            const result2 = await factory.connect(core.governance)
                .ownerSetIsTokenConverterTrusted(newConverter.address, false);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(newConverter.address)).to.eq(false);
            await (0, assertions_1.expectEvent)(factory, result2, 'TokenConverterSet', {
                tokenConverter: newConverter.address,
                isTrusted: false,
            });
        });
        it('should fail when not called by owner', async () => {
            const newConverter = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).ownerSetIsTokenConverterTrusted(newConverter.address, true), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when zero address is used', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.governance).ownerSetIsTokenConverterTrusted(Addresses_1.ZERO_ADDRESS, true), 'IsolationModeVaultFactory: Invalid token converter');
        });
        it('should fail when not not initialized', async () => {
            const newConverter = await (0, dolomite_utils_1.createContractWithAbi)(types_1.IsolationModeUpgradeableProxy__factory.abi, types_1.IsolationModeUpgradeableProxy__factory.bytecode, []);
            const uninitializedFactory = await createUninitializedFactory();
            await (0, assertions_1.expectThrow)(uninitializedFactory.ownerSetIsTokenConverterTrusted(newConverter.address, true), 'IsolationModeVaultFactory: Not initialized');
        });
    });
    describe('#depositOtherTokenIntoDolomiteMarginForVaultOwner', () => {
        it('should work normally', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            await rewardToken.addBalance(vault.address, amountWei);
            await vault.callDepositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, rewardMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, toAccountNumber, rewardMarketId, amountWei);
            await (0, assertions_1.expectProtocolBalance)(core, vaultAddress, 0, rewardMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, vaultAddress, toAccountNumber, rewardMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, rewardToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(vaultAddress, rewardToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin.address, rewardToken, amountWei);
            await (0, assertions_1.expectWalletAllowance)(core.hhUser1, vault, rewardToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletAllowance)(vault, core.dolomiteMargin.address, rewardToken, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when invalid market ID sent', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            const vault = await (0, utils_1.impersonate)(vaultAddress, true);
            await (0, assertions_1.expectThrow)(factory.connect(vault)
                .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, underlyingMarketId, amountWei), `IsolationModeVaultFactory: Invalid market <${underlyingMarketId.toString()}>`);
        });
        it('should fail when not called by vault', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1)
                .depositOtherTokenIntoDolomiteMarginForVaultOwner(toAccountNumber, core.marketIds.weth, amountWei), `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#enqueueTransferIntoDolomiteMargin', () => {
        async function executeWrapV1(vaultImplementation, inputMarketId, outputMarketId, signer) {
            const solidAccountId = 0;
            const actions = await tokenWrapperV1.createActionsForWrapping(solidAccountId, 
            /* _liquidAccountId = */ 0, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, outputMarketId, inputMarketId, no_deps_constants_1.ZERO_BI, smallAmountWei);
            return core.dolomiteMargin
                .connect(signer !== null && signer !== void 0 ? signer : vaultImplementation)
                .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
        }
        async function executeWrapV2(vaultImplementation, inputMarketId, outputMarketId, signer) {
            const solidAccountId = 0;
            const actions = await tokenWrapperV2.createActionsForWrapping(solidAccountId, 
            /* _liquidAccountId = */ 0, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, outputMarketId, inputMarketId, no_deps_constants_1.ZERO_BI, smallAmountWei, no_deps_constants_1.BYTES_EMPTY);
            return core.dolomiteMargin
                .connect(signer !== null && signer !== void 0 ? signer : vaultImplementation)
                .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
        }
        it('should work when called by a V1 token converter', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vault = await (0, setup_1.setupUserVaultProxy)(await factory.getVaultByAccount(core.hhUser1.address), types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            const vaultImplementation = await (0, utils_1.impersonate)(vault.address, true);
            await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
            await (0, assertions_1.expectThrow)(executeWrapV1(vaultImplementation, otherMarketId, core.marketIds.weth), `IsolationModeWrapperTraderV1: Invalid output market <${core.marketIds.weth.toString()}>`);
            await (0, assertions_1.expectThrow)(tokenWrapperV1.connect(core.hhUser1)
                .exchange(core.hhUser1.address, core.dolomiteMargin.address, underlyingToken.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
            const result = await executeWrapV1(vaultImplementation, otherMarketId, underlyingMarketId);
            const queuedTransfer = await factory.getQueuedTransferByCursor(2);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(tokenWrapperV1.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(smallAmountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vault.address);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: tokenWrapperV1.address,
                to: core.dolomiteMargin.address,
                amount: smallAmountWei,
                vault: vault.address,
            });
            const cumulativeBalance = amountWei.add(smallAmountWei);
            (0, chai_1.expect)(await otherToken.balanceOf(tokenWrapperV1.address)).to.eq(smallAmountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(tokenWrapperV1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
            (0, chai_1.expect)(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
            await (0, assertions_1.expectProtocolBalance)(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
        });
        it('should work when called by a V2 token converter', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vault = await (0, setup_1.setupUserVaultProxy)(await factory.getVaultByAccount(core.hhUser1.address), types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            const vaultImplementation = await (0, utils_1.impersonate)(vault.address, true);
            await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenWrapperV1.address)).to.eq(true);
            await (0, assertions_1.expectThrow)(executeWrapV2(vaultImplementation, otherMarketId, core.marketIds.weth), `IsolationModeWrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`);
            await (0, assertions_1.expectThrow)(tokenWrapperV2.connect(core.hhUser1)
                .exchange(core.hhUser1.address, core.dolomiteMargin.address, underlyingToken.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
            const result = await executeWrapV2(vaultImplementation, otherMarketId, underlyingMarketId);
            const queuedTransfer = await factory.getQueuedTransferByCursor(2);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(tokenWrapperV2.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(smallAmountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vault.address);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: tokenWrapperV2.address,
                to: core.dolomiteMargin.address,
                amount: smallAmountWei,
                vault: vault.address,
            });
            const cumulativeBalance = amountWei.add(smallAmountWei);
            (0, chai_1.expect)(await otherToken.balanceOf(tokenWrapperV2.address)).to.eq(smallAmountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(tokenWrapperV2.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
            (0, chai_1.expect)(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
            await (0, assertions_1.expectProtocolBalance)(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
        });
        it('should fail when not called by token converter', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).enqueueTransferIntoDolomiteMargin(core.hhUser1.address, amountWei), `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should overwrite cursor if already queued', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            await factory.testEnqueueTransfer(vaultAddress, core.dolomiteMargin.address, amountWei, vaultAddress);
            await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser2.address, true);
            const result = await factory.connect(core.hhUser2)
                .enqueueTransferIntoDolomiteMargin(vaultAddress, amountWei);
            const queuedTransfer = await factory.getQueuedTransferByCursor(1);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(core.hhUser2.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(amountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vaultAddress);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 1,
                from: core.hhUser2.address,
                to: core.dolomiteMargin.address,
                amount: amountWei,
                vault: vaultAddress,
            });
        });
        it('should fail when vault is invalid', async () => {
            await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser3.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser3).enqueueTransferIntoDolomiteMargin(core.hhUser4.address, amountWei), `IsolationModeVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`);
        });
    });
    describe('#enqueueTransferFromDolomiteMargin', () => {
        async function executeUnwrapV1(vaultImplementation, inputMarketId, outputMarketId, signer) {
            const solidAccountId = 0;
            const actions = await tokenUnwrapperV1.createActionsForUnwrappingForLiquidation(solidAccountId, solidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, outputMarketId, inputMarketId, no_deps_constants_1.ZERO_BI, smallAmountWei);
            return core.dolomiteMargin
                .connect(signer !== null && signer !== void 0 ? signer : vaultImplementation)
                .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
        }
        async function executeUnwrapV2(vaultImplementation, inputMarketId, outputMarketId, signer) {
            const solidAccountId = 0;
            const actions = await tokenUnwrapperV2.createActionsForUnwrapping(solidAccountId, solidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, outputMarketId, inputMarketId, no_deps_constants_1.ZERO_BI, smallAmountWei, no_deps_constants_1.BYTES_EMPTY);
            return core.dolomiteMargin
                .connect(signer !== null && signer !== void 0 ? signer : vaultImplementation)
                .operate([{ owner: vaultImplementation.address, number: toAccountNumber }], actions);
        }
        it('should work when called by a V1 token converter', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vault = await (0, setup_1.setupUserVaultProxy)(await factory.getVaultByAccount(core.hhUser1.address), types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            const vaultImplementation = await (0, utils_1.impersonate)(vault.address, true);
            await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenUnwrapperV1.address)).to.eq(true);
            await core.dolomiteMargin.ownerSetGlobalOperator(vaultImplementation.address, true);
            await (0, assertions_1.expectThrow)(executeUnwrapV1(vaultImplementation, core.marketIds.weth, otherMarketId), `IsolationModeUnwrapperTraderV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
            const result = await executeUnwrapV1(vaultImplementation, underlyingMarketId, otherMarketId);
            const queuedTransfer = await factory.getQueuedTransferByCursor(2);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(tokenUnwrapperV1.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(smallAmountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vault.address);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: core.dolomiteMargin.address,
                to: tokenUnwrapperV1.address,
                amount: smallAmountWei,
                vault: vault.address,
            });
            const cumulativeBalance = amountWei.sub(smallAmountWei);
            (0, chai_1.expect)(await otherToken.balanceOf(core.dolomiteMargin.address)).to.eq(smallAmountWei.add(amountWei));
            (0, chai_1.expect)(await underlyingToken.balanceOf(tokenUnwrapperV1.address)).to.eq(smallAmountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
            (0, chai_1.expect)(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
            await (0, assertions_1.expectProtocolBalance)(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
        });
        it('should work when called by a V2 token converter', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vault = await (0, setup_1.setupUserVaultProxy)(await factory.getVaultByAccount(core.hhUser1.address), types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            const vaultImplementation = await (0, utils_1.impersonate)(vault.address, true);
            await otherToken.addBalance(core.dolomiteMargin.address, amountWei);
            (0, chai_1.expect)(await factory.isTokenConverterTrusted(tokenUnwrapperV2.address)).to.eq(true);
            await core.dolomiteMargin.ownerSetGlobalOperator(vaultImplementation.address, true);
            await (0, assertions_1.expectThrow)(executeUnwrapV2(vaultImplementation, core.marketIds.weth, otherMarketId), `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`);
            const result = await executeUnwrapV2(vaultImplementation, underlyingMarketId, otherMarketId);
            const queuedTransfer = await factory.getQueuedTransferByCursor(2);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(tokenUnwrapperV2.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(smallAmountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vault.address);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: core.dolomiteMargin.address,
                to: tokenUnwrapperV2.address,
                amount: smallAmountWei,
                vault: vault.address,
            });
            const cumulativeBalance = amountWei.sub(smallAmountWei);
            (0, chai_1.expect)(await otherToken.balanceOf(core.dolomiteMargin.address)).to.eq(smallAmountWei.add(amountWei));
            (0, chai_1.expect)(await underlyingToken.balanceOf(tokenUnwrapperV2.address)).to.eq(smallAmountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(cumulativeBalance);
            (0, chai_1.expect)(await factory.balanceOf(core.dolomiteMargin.address)).to.eq(cumulativeBalance);
            await (0, assertions_1.expectProtocolBalance)(core, vault.address, toAccountNumber, underlyingMarketId, cumulativeBalance);
        });
        it('should fail when not called by token converter', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).enqueueTransferFromDolomiteMargin(core.hhUser1.address, amountWei), `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should overwrite cursor if already queued', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser2.address, true);
            await factory.connect(core.hhUser2).enqueueTransferIntoDolomiteMargin(vaultAddress, amountWei);
            (0, chai_1.expect)(await factory.allowance(vaultAddress, core.dolomiteMargin.address)).to.eq(amountWei);
            (0, chai_1.expect)(await factory.transferCursor()).to.eq(1);
            const result = await factory.connect(core.hhUser2)
                .enqueueTransferFromDolomiteMargin(vaultAddress, amountWei);
            (0, chai_1.expect)(await factory.allowance(vaultAddress, core.dolomiteMargin.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await factory.transferCursor()).to.eq(2);
            const queuedTransfer = await factory.getQueuedTransferByCursor(2);
            (0, chai_1.expect)(queuedTransfer.from).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(core.hhUser2.address);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(amountWei);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(vaultAddress);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: core.dolomiteMargin.address,
                to: core.hhUser2.address,
                amount: amountWei,
                vault: vaultAddress,
            });
        });
        it('should fail when vault is invalid', async () => {
            await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser3.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser3).enqueueTransferFromDolomiteMargin(core.hhUser4.address, amountWei), `IsolationModeVaultFactory: Invalid vault <${core.hhUser4.address.toLowerCase()}>`);
        });
    });
    describe('#depositIntoDolomiteMargin', () => {
        it('should work normally', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.IsolationModeTokenVaultV1__factory, core.hhUser1);
            const result = await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 1,
                from: vault.address,
                to: core.dolomiteMargin.address,
                amount: amountWei,
                vault: vault.address,
            });
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, vaultAddress, toAccountNumber, underlyingMarketId, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(vaultAddress, underlyingToken, amountWei);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin.address, factory, amountWei);
            await (0, assertions_1.expectWalletAllowance)(core.hhUser1, vault, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletAllowance)(vault, core.dolomiteMargin.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectTotalSupply)(factory, amountWei);
        });
        it('should fail when not called by vault', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).depositIntoDolomiteMargin(toAccountNumber, amountWei), `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#withdrawFromDolomiteMargin', () => {
        it('should work normally', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.IsolationModeTokenVaultV1__factory, core.hhUser1);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            const result = await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);
            await (0, assertions_1.expectEvent)(factory, result, 'TransferQueued', {
                transferCursor: 2,
                from: core.dolomiteMargin.address,
                to: vault.address,
                amount: amountWei,
                vault: vault.address,
            });
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1.address, toAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, vaultAddress, toAccountNumber, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.hhUser1, underlyingToken, amountWei);
            await (0, assertions_1.expectWalletBalance)(vaultAddress, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.dolomiteMargin.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletAllowance)(core.hhUser1, vault, underlyingToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletAllowance)(vault, core.dolomiteMargin.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectTotalSupply)(factory, no_deps_constants_1.ZERO_BI);
        });
        it('should fail when balance would go negative', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.IsolationModeTokenVaultV1__factory, core.hhUser1);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, amountWei);
            await vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei);
            await (0, assertions_1.expectThrow)(vault.withdrawFromVaultForDolomiteMargin(toAccountNumber, amountWei), 'Token: transfer failed');
        });
        it('should fail when not called by vault', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).withdrawFromDolomiteMargin(toAccountNumber, amountWei), `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#_transfer', () => {
        it('should not work when not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).transfer(core.hhUser2.address, amountWei), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should not work when transferring from the 0 address', async () => {
            const zeroSigner = await (0, utils_1.impersonate)(Addresses_1.ZERO_ADDRESS, true);
            await factory.connect(zeroSigner).setShouldSpendAllowance(false);
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transferFrom(Addresses_1.ZERO_ADDRESS, core.hhUser1.address, amountWei), 'IsolationModeVaultFactory: Transfer from the zero address');
        });
        it('should not work when transferring to the 0 address', async () => {
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transfer(Addresses_1.ZERO_ADDRESS, amountWei), 'IsolationModeVaultFactory: Transfer to the zero address');
        });
        it('should not work when from/to is not DolomiteMargin', async () => {
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await factory.connect(core.hhUser1).approve(sender.address, ethers_1.ethers.constants.MaxUint256);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transferFrom(core.hhUser1.address, core.hhUser2.address, amountWei), 'IsolationModeVaultFactory: from/to must eq DolomiteMargin');
        });
        it('should not work when transfer is not queued', async () => {
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transfer(core.hhUser2.address, amountWei), 'IsolationModeVaultFactory: Invalid queued transfer');
        });
        it('should not work when transfer is already executed', async () => {
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
            const vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.IsolationModeTokenVaultV1__factory, core.hhUser1);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
            await vault.depositIntoVaultForDolomiteMargin(toAccountNumber, smallAmountWei);
            const vaultImpersonator = await (0, utils_1.impersonate)(vaultAddress, true);
            await factory.connect(vaultImpersonator).approve(core.dolomiteMargin.address, smallAmountWei);
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transferFrom(vaultAddress, core.dolomiteMargin.address, smallAmountWei), 'IsolationModeVaultFactory: Transfer already executed <1>');
        });
        it('should not work when transfer is queued but FROM is invalid vault', async () => {
            await factory.createVault(core.hhUser1.address);
            const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
            const spender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            await factory.connect(core.hhUser1).approve(spender.address, amountWei);
            await factory.testEnqueueTransfer(core.hhUser1.address, core.dolomiteMargin.address, amountWei, vaultAddress);
            (0, chai_1.expect)(await factory.transferCursor()).to.eq('0');
            const currentTransfer = await factory.getQueuedTransferByCursor('0');
            (0, chai_1.expect)(currentTransfer.from).to.eq(core.hhUser1.address);
            (0, chai_1.expect)(currentTransfer.to).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(currentTransfer.amount).to.eq(amountWei);
            (0, chai_1.expect)(currentTransfer.vault).to.eq(vaultAddress);
            await (0, assertions_1.expectThrow)(factory.connect(spender).transferFrom(core.hhUser1.address, core.dolomiteMargin.address, amountWei), 'IsolationModeVaultFactory: Invalid from');
        });
        it('should not work when transfer is queued but TO is invalid vault', async () => {
            await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
            const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
            await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);
            await factory.connect(core.hhUser1).createVault(core.hhUser1.address);
            await factory.testEnqueueTransfer(core.dolomiteMargin.address, core.hhUser1.address, amountWei, vaultAddress);
            (0, chai_1.expect)(await factory.transferCursor()).to.eq('0');
            const currentTransfer = await factory.getQueuedTransferByCursor('0');
            (0, chai_1.expect)(currentTransfer.from).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(currentTransfer.to).to.eq(core.hhUser1.address);
            (0, chai_1.expect)(currentTransfer.amount).to.eq(amountWei);
            (0, chai_1.expect)(currentTransfer.vault).to.eq(vaultAddress);
            const sender = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(factory.connect(sender).transfer(core.hhUser1.address, amountWei), 'IsolationModeVaultFactory: Invalid to');
        });
    });
    describe('#isIsolationAsset', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.isIsolationAsset()).to.eq(true);
        });
    });
    describe('#getProxyVaultInitCodeHash', () => {
        it('should work normally', async () => {
            const bytecode = types_1.IsolationModeUpgradeableProxy__factory.bytecode;
            (0, chai_1.expect)(await factory.getProxyVaultInitCodeHash()).to.eq(ethers_1.ethers.utils.keccak256(bytecode));
        });
    });
    describe('#getQueuedTransferByCursor', () => {
        it('should work when transfer cursor is lte current cursor', async () => {
            // the user has not queued any transfers yet. The current cursor is 0.
            const queuedTransfer = await factory.getQueuedTransferByCursor('0');
            (0, chai_1.expect)(queuedTransfer.from).to.eq(Addresses_1.ZERO_ADDRESS);
            (0, chai_1.expect)(queuedTransfer.to).to.eq(Addresses_1.ZERO_ADDRESS);
            (0, chai_1.expect)(queuedTransfer.amount).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(queuedTransfer.vault).to.eq(Addresses_1.ZERO_ADDRESS);
        });
        it('should fail when transfer cursor is gt current cursor', async () => {
            // the user has not queued any transfers yet. The current cursor is 0.
            await (0, assertions_1.expectThrow)(factory.getQueuedTransferByCursor('1'), 'IsolationModeVaultFactory: Invalid transfer cursor');
        });
    });
    describe('#name', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.name()).to.eq('Dolomite Isolation: Test Token');
        });
    });
    describe('#symbol', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.symbol()).to.eq('dTEST');
        });
    });
    describe('#decimals', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.decimals()).to.eq(18);
        });
    });
});

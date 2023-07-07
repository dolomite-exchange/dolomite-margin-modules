"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const testers_1 = require("../../utils/ecosystem-token-utils/testers");
const setup_1 = require("../../utils/setup");
describe('IsolationModeUpgradeableProxy', () => {
    let snapshotId;
    let core;
    let factory;
    let userVaultImplementation;
    let vaultProxy;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        const underlyingToken = await (0, dolomite_utils_1.createTestToken)();
        userVaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeTokenVaultV1__factory.abi, types_1.TestIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, testers_1.createTestIsolationModeFactory)(core, underlyingToken, userVaultImplementation);
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        await (0, setup_1.setupTestMarket)(core, factory, true);
        const tokenUnwrapper = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeUnwrapperTrader__factory.abi, types_1.TestIsolationModeUnwrapperTrader__factory.bytecode, [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address]);
        await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vaultProxy = await (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.IsolationModeUpgradeableProxy__factory, core.hhUser1);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#initialize', () => {
        it('should work under normal conditions', async () => {
            await factory.createVaultNoInitialize(core.hhUser2.address);
            const vault2Address = await factory.getVaultByAccount(core.hhUser2.address);
            const vault2 = (0, setup_1.setupUserVaultProxy)(vault2Address, types_1.IsolationModeUpgradeableProxy__factory, core.hhUser2);
            await vault2.initialize(core.hhUser2.address);
            (0, chai_1.expect)(await vault2.isInitialized()).to.eq(true);
            (0, chai_1.expect)(await vault2.owner()).to.eq(core.hhUser2.address);
        });
        it('should fail if already initialized', async () => {
            await (0, assertions_1.expectThrow)(vaultProxy.initialize(core.hhUser1.address), 'IsolationModeUpgradeableProxy: Already initialized');
        });
        it('should fail if invalid account', async () => {
            await (0, assertions_1.expectThrow)(factory.createVaultWithDifferentAccount(core.hhUser2.address, core.hhUser3.address), `IsolationModeUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`);
        });
    });
    describe('#fallback', () => {
        it('should work normally', async () => {
            const vaultImpl = (0, setup_1.setupUserVaultProxy)(vaultProxy.address, types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser1);
            (0, chai_1.expect)(await vaultImpl.VAULT_FACTORY()).to.eq(factory.address);
        });
        it('should fail when not initialized', async () => {
            await factory.createVaultNoInitialize(core.hhUser2.address);
            const vaultAddress = await factory.getVaultByAccount(core.hhUser2.address);
            const vaultImpl = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.TestIsolationModeTokenVaultV1__factory, core.hhUser2);
            await (0, assertions_1.expectThrow)(vaultImpl.VAULT_FACTORY(), 'IsolationModeUpgradeableProxy: Not initialized');
        });
    });
    describe('#implementation', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vaultProxy.implementation()).to.eq(userVaultImplementation.address);
        });
    });
    describe('#isInitialized', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vaultProxy.isInitialized()).to.eq(true);
        });
    });
    describe('#vaultFactory', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vaultProxy.vaultFactory()).to.eq(factory.address);
        });
    });
    describe('#owner', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vaultProxy.owner()).to.eq(core.hhUser1.address);
        });
    });
});

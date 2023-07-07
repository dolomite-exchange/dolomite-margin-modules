"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const umami_1 = require("../../utils/ecosystem-token-utils/umami");
const setup_1 = require("../../utils/setup");
describe('UmamiAssetVaultIsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let umamiRegistry;
    let unwrapper;
    let wrapper;
    let priceOracle;
    let factory;
    let vault;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = core.umamiEcosystem.glpUsdc.connect(core.hhUser1);
        const userVaultImplementation = await (0, umami_1.createUmamiAssetVaultIsolationModeTokenVaultV1)();
        umamiRegistry = await (0, umami_1.createUmamiAssetVaultRegistry)(core);
        factory = await (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, umamiRegistry, underlyingToken, core.tokens.usdc, userVaultImplementation);
        unwrapper = await (0, umami_1.createUmamiAssetVaultIsolationModeUnwrapperTraderV2)(core, umamiRegistry, factory);
        wrapper = await (0, umami_1.createUmamiAssetVaultIsolationModeWrapperTraderV2)(core, umamiRegistry, factory);
        priceOracle = await (0, umami_1.createUmamiAssetVaultPriceOracle)(core, umamiRegistry, factory);
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory, core.hhUser1);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#registry', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.registry()).to.equal(umamiRegistry.address);
        });
    });
    describe('#isExternalRedemptionPaused', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
        });
        it('should be paused when aggregateVault pauses vault', async () => {
            const admin = await (0, utils_1.impersonate)(await core.umamiEcosystem.whitelist.aggregateVault(), true);
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            await core.umamiEcosystem.glpUsdc.connect(admin).pauseDepositWithdraw();
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
            await core.umamiEcosystem.glpUsdc.connect(admin).unpauseDepositWithdraw();
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
        });
    });
});

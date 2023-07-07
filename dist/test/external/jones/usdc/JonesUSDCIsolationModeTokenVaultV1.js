"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../../src/types");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
const setup_1 = require("../../../utils/setup");
const jones_utils_1 = require("./jones-utils");
describe('JonesUSDCIsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let jonesUSDCRegistry;
    let unwrapper;
    let wrapper;
    let priceOracle;
    let factory;
    let vault;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        underlyingToken = core.jonesEcosystem.jUSDC.connect(core.hhUser1);
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapper.address);
        wrapper = await (0, jones_1.createJonesUSDCIsolationModeWrapperTraderV2)(core, jonesUSDCRegistry, factory);
        priceOracle = await (0, jones_1.createJonesUSDCPriceOracle)(core, jonesUSDCRegistry, factory);
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.JonesUSDCIsolationModeTokenVaultV1__factory, core.hhUser1);
        await (0, jones_utils_1.createRoleAndWhitelistTrader)(core, unwrapper, wrapper);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#registry', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.registry()).to.equal(jonesUSDCRegistry.address);
        });
    });
    describe('#isExternalRedemptionPaused', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
        });
        it('should be paused when router is paused', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            await core.jonesEcosystem.glpVaultRouter.connect(core.jonesEcosystem.admin).toggleEmergencyPause();
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.glpVaultRouter.emergencyPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.getUserRole(unwrapper.address)).to.eq(jones_utils_1.TRADER_ROLE);
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.isWhitelistedContract(unwrapper.address)).to.be.true;
        });
        it('should be paused when redemption bypass time is not active', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            const whitelistOwner = await (0, utils_1.impersonate)(await core.jonesEcosystem.whitelistController.owner());
            await core.jonesEcosystem.whitelistController.connect(whitelistOwner).removeUserFromRole(unwrapper.address);
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.glpVaultRouter.emergencyPaused()).to.be.false;
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.getUserRole(unwrapper.address)).to.eq(no_deps_constants_1.BYTES_ZERO);
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.isWhitelistedContract(unwrapper.address)).to.be.true;
        });
        it('should be paused when unwrapper is not whitelisted', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            const whitelistOwner = await (0, utils_1.impersonate)(await core.jonesEcosystem.whitelistController.owner());
            await core.jonesEcosystem.whitelistController.connect(whitelistOwner)
                .removeFromWhitelistContract(unwrapper.address);
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.glpVaultRouter.emergencyPaused()).to.be.false;
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.getUserRole(unwrapper.address)).to.eq(jones_utils_1.TRADER_ROLE);
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.isWhitelistedContract(unwrapper.address)).to.be.false;
        });
        it('should be paused when redemption bypass time is not active or router is paused or not whitelisted', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            const whitelistOwner = await (0, utils_1.impersonate)(await core.jonesEcosystem.whitelistController.owner());
            await core.jonesEcosystem.whitelistController.connect(whitelistOwner).removeUserFromRole(unwrapper.address);
            await core.jonesEcosystem.whitelistController.connect(whitelistOwner)
                .removeFromWhitelistContract(unwrapper.address);
            await core.jonesEcosystem.glpVaultRouter.connect(core.jonesEcosystem.admin).toggleEmergencyPause();
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.glpVaultRouter.emergencyPaused()).to.be.true;
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.getUserRole(unwrapper.address)).to.eq(no_deps_constants_1.BYTES_ZERO);
            (0, chai_1.expect)(await core.jonesEcosystem.whitelistController.isWhitelistedContract(unwrapper.address)).to.be.false;
        });
    });
});

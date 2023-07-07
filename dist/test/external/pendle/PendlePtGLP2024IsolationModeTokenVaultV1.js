"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const pendle_1 = require("../../utils/ecosystem-token-utils/pendle");
const setup_1 = require("../../utils/setup");
describe('PendlePtGLP2024IsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let pendleRegistry;
    let unwrapper;
    let wrapper;
    let priceOracle;
    let factory;
    let vault;
    let underlyingMarketId;
    let rewardToken;
    let farm;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = core.pendleEcosystem.ptGlpToken.connect(core.hhUser1);
        rewardToken = core.plutusEcosystem.plsToken.connect(core.hhUser1);
        farm = core.plutusEcosystem.plvGlpFarm.connect(core.hhUser1);
        const userVaultImplementation = await (0, pendle_1.createPendlePtGLP2024IsolationModeTokenVaultV1)();
        pendleRegistry = await (0, pendle_1.createPendlePtGLP2024Registry)(core);
        factory = await (0, pendle_1.createPendlePtGLP2024IsolationModeVaultFactory)(core, pendleRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, pendle_1.createPendlePtGLP2024IsolationModeUnwrapperTraderV2)(core, factory, pendleRegistry);
        wrapper = await (0, pendle_1.createPendlePtGLP2024IsolationModeWrapperTraderV2)(core, factory, pendleRegistry);
        priceOracle = await (0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory, core.hhUser1);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#isExternalRedemptionPaused', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
        });
        it('should work when owner pauses syGLP', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            const syGlp = types_1.IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
            const owner = await (0, utils_1.impersonate)(await syGlp.owner(), true);
            await syGlp.connect(owner).pause();
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
        });
    });
});

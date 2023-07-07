"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const pendle_1 = require("../../utils/ecosystem-token-utils/pendle");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('PendlePtGLP2024Registry', () => {
    let snapshotId;
    let core;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        registry = await (0, pendle_1.createPendlePtGLP2024Registry)(core);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await registry.pendleRouter()).to.equal(core.pendleEcosystem.pendleRouter.address);
            (0, chai_1.expect)(await registry.ptGlpMarket()).to.equal(core.pendleEcosystem.ptGlpMarket.address);
            (0, chai_1.expect)(await registry.ptGlpToken()).to.equal(core.pendleEcosystem.ptGlpToken.address);
            (0, chai_1.expect)(await registry.ptOracle()).to.equal(core.pendleEcosystem.ptOracle.address);
            (0, chai_1.expect)(await registry.syGlpToken()).to.equal(core.pendleEcosystem.syGlpToken.address);
        });
    });
    describe('#ownerSetPendleRouter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPendleRouter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PendleRouterSet', {
                pendleRouter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.pendleRouter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPendleRouter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPendleRouter(Addresses_1.ZERO_ADDRESS), 'PendlePtGLP2024Registry: Invalid pendleRouter address');
        });
    });
    describe('#ownerSetPtGlpMarket', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPtGlpMarket(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PtGlpMarketSet', {
                plvGlpToken: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.ptGlpMarket()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPtGlpMarket(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPtGlpMarket(Addresses_1.ZERO_ADDRESS), 'PendlePtGLP2024Registry: Invalid ptGlpMarket address');
        });
    });
    describe('#ownerSetPtGlpToken', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPtGlpToken(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PtGlpTokenSet', {
                glp: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.ptGlpToken()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPtGlpToken(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPtGlpToken(Addresses_1.ZERO_ADDRESS), 'PendlePtGLP2024Registry: Invalid ptGlpToken address');
        });
    });
    describe('#ownerSetPtOracle', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPtOracle(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PtOracleSet', {
                glpManager: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.ptOracle()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPtOracle(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPtOracle(Addresses_1.ZERO_ADDRESS), 'PendlePtGLP2024Registry: Invalid ptOracle address');
        });
    });
    describe('#ownerSetSyGlpToken', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetSyGlpToken(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'SyGlpTokenSet', {
                glpManager: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.syGlpToken()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetSyGlpToken(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetSyGlpToken(Addresses_1.ZERO_ADDRESS), 'PendlePtGLP2024Registry: Invalid syGlpToken address');
        });
    });
});

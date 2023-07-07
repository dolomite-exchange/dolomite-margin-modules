"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('PlutusVaultRegistry', () => {
    let snapshotId;
    let core;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        registry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await registry.plutusToken()).to.equal(core.plutusEcosystem.plsToken.address);
            (0, chai_1.expect)(await registry.plvGlpToken()).to.equal(core.plutusEcosystem.plvGlp.address);
            (0, chai_1.expect)(await registry.plvGlpRouter()).to.equal(core.plutusEcosystem.plvGlpRouter.address);
            (0, chai_1.expect)(await registry.plvGlpFarm()).to.equal(core.plutusEcosystem.plvGlpFarm.address);
        });
    });
    describe('#ownerSetPlutusToken', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPlutusToken(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PlutusTokenSet', {
                plutusToken: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.plutusToken()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPlutusToken(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPlutusToken(Addresses_1.ZERO_ADDRESS), 'PlutusVaultRegistry: Invalid plutusToken address');
        });
    });
    describe('#ownerSetPlvGlpToken', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPlvGlpToken(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PlvGlpTokenSet', {
                plvGlpToken: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.plvGlpToken()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPlvGlpToken(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPlvGlpToken(Addresses_1.ZERO_ADDRESS), 'PlutusVaultRegistry: Invalid plvGlpToken address');
        });
    });
    describe('#ownerSetPlvGlpRouter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPlvGlpRouter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PlvGlpRouterSet', {
                glp: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.plvGlpRouter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPlvGlpRouter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPlvGlpRouter(Addresses_1.ZERO_ADDRESS), 'PlutusVaultRegistry: Invalid plvGlpRouter address');
        });
    });
    describe('#ownerSetPlvGlpFarm', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetPlvGlpFarm(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'PlvGlpFarmSet', {
                glpManager: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.plvGlpFarm()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetPlvGlpFarm(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetPlvGlpFarm(Addresses_1.ZERO_ADDRESS), 'PlutusVaultRegistry: Invalid plvGlpFarm address');
        });
    });
});

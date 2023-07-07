"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const gmx_1 = require("../../utils/ecosystem-token-utils/gmx");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('GmxRegistryV1', () => {
    let snapshotId;
    let core;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        registry = await (0, gmx_1.createGmxRegistry)(core);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await registry.esGmx()).to.equal(core.gmxEcosystem.esGmx.address);
            (0, chai_1.expect)(await registry.fsGlp()).to.equal(core.gmxEcosystem.fsGlp.address);
            (0, chai_1.expect)(await registry.glp()).to.equal(core.gmxEcosystem.glp.address);
            (0, chai_1.expect)(await registry.glpManager()).to.equal(core.gmxEcosystem.glpManager.address);
            (0, chai_1.expect)(await registry.glpRewardsRouter()).to.equal(core.gmxEcosystem.glpRewardsRouter.address);
            (0, chai_1.expect)(await registry.gmx()).to.equal(core.gmxEcosystem.gmx.address);
            (0, chai_1.expect)(await registry.gmxRewardsRouter()).to.equal(core.gmxEcosystem.gmxRewardsRouter.address);
            (0, chai_1.expect)(await registry.gmxVault()).to.equal(core.gmxEcosystem.gmxVault.address);
            (0, chai_1.expect)(await registry.sGlp()).to.equal(core.gmxEcosystem.sGlp.address);
            (0, chai_1.expect)(await registry.sGmx()).to.equal(core.gmxEcosystem.sGmx.address);
            (0, chai_1.expect)(await registry.sbfGmx()).to.equal(core.gmxEcosystem.sbfGmx.address);
            (0, chai_1.expect)(await registry.vGlp()).to.equal(core.gmxEcosystem.vGlp.address);
            (0, chai_1.expect)(await registry.vGmx()).to.equal(core.gmxEcosystem.vGmx.address);
        });
    });
    describe('#ownerSetEsGmx', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetEsGmx(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'EsGmxSet', {
                esGmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.esGmx()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetEsGmx(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetEsGmx(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid esGmx address');
        });
    });
    describe('#ownerSetFSGlp', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetFSGlp(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'FSGlpSet', {
                esGmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.fsGlp()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetFSGlp(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetFSGlp(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid fsGlp address');
        });
    });
    describe('#ownerSetGlp', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGlp(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GlpSet', {
                glp: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.glp()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGlp(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGlp(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid glp address');
        });
    });
    describe('#ownerSetGlpManager', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGlpManager(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GlpManagerSet', {
                glpManager: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.glpManager()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGlpManager(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGlpManager(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid glpManager address');
        });
    });
    describe('#ownerSetGlpRewardsRouter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGlpRewardsRouter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GlpRewardsRouterSet', {
                glpRewardsRouter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.glpRewardsRouter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGlpRewardsRouter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGlpRewardsRouter(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid glpRewardsRouter address');
        });
    });
    describe('#ownerSetGmx', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGmx(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GmxSet', {
                gmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.gmx()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGmx(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGmx(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid gmx address');
        });
    });
    describe('#ownerSetGmxRewardsRouter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGmxRewardsRouter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GmxRewardsRouterSet', {
                gmxRewardsRouter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.gmxRewardsRouter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGmxRewardsRouter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGmxRewardsRouter(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid gmxRewardsRouter address');
        });
    });
    describe('#ownerSetGmxVault', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGmxVault(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GmxVaultSet', {
                gmxVault: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.gmxVault()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGmxVault(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGmxVault(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid gmxVault address');
        });
    });
    describe('#ownerSetSGlp', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetSGlp(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'SGlpSet', {
                sGlp: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.sGlp()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetSGlp(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetSGlp(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid sGlp address');
        });
    });
    describe('#ownerSetSGmx', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetSGmx(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'SGmxSet', {
                sGmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.sGmx()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetSGmx(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetSGmx(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid sGmx address');
        });
    });
    describe('#ownerSetSbfGmx', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetSbfGmx(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'SbfGmxSet', {
                sbfGmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.sbfGmx()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetSbfGmx(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetSbfGmx(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid sbfGmx address');
        });
    });
    describe('#ownerSetVGlp', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetVGlp(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'VGlpSet', {
                vGlp: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.vGlp()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetVGlp(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetVGlp(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid vGlp address');
        });
    });
    describe('#ownerSetVGmx', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetVGmx(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'VGmxSet', {
                vGmx: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.vGmx()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetVGmx(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetVGmx(Addresses_1.ZERO_ADDRESS), 'GmxRegistryV1: Invalid vGmx address');
        });
    });
});

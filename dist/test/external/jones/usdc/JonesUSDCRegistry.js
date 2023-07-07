"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
const setup_1 = require("../../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('JonesUSDCRegistry', () => {
    let snapshotId;
    let core;
    let registry;
    let unwrapper;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        registry = await (0, jones_1.createJonesUSDCRegistry)(core);
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        const factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, registry, core.jonesEcosystem.jUSDC, userVaultImplementation);
        unwrapper = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, registry, factory);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            await registry.connect(core.hhUser1).initializeUnwrapperTrader(unwrapper.address);
            (0, chai_1.expect)(await registry.glpAdapter()).to.equal(core.jonesEcosystem.glpAdapter.address);
            (0, chai_1.expect)(await registry.glpVaultRouter()).to.equal(core.jonesEcosystem.glpVaultRouter.address);
            (0, chai_1.expect)(await registry.whitelistController()).to.equal(core.jonesEcosystem.whitelistController.address);
            (0, chai_1.expect)(await registry.usdcReceiptToken()).to.equal(core.jonesEcosystem.usdcReceiptToken.address);
            (0, chai_1.expect)(await registry.jUSDC()).to.equal(core.jonesEcosystem.jUSDC.address);
            (0, chai_1.expect)(await registry.unwrapperTrader()).to.equal(unwrapper.address);
        });
    });
    describe('#initializeUnwrapperTrader', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.hhUser1).initializeUnwrapperTrader(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'UnwrapperTraderSet', {
                glpAdapter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.unwrapperTrader()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when already initialized', async () => {
            await registry.connect(core.hhUser1).initializeUnwrapperTrader(OTHER_ADDRESS);
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).initializeUnwrapperTrader(OTHER_ADDRESS), 'JonesUSDCRegistry: Already initialized');
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).initializeUnwrapperTrader(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid unwrapperTrader address');
        });
    });
    describe('#ownerGlpAdapter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerGlpAdapter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GlpAdapterSet', {
                glpAdapter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.glpAdapter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerGlpAdapter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerGlpAdapter(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid glpAdapter address');
        });
    });
    describe('#ownerSetGlpVaultRouter', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetGlpVaultRouter(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'GlpVaultRouterSet', {
                glpVaultRouter: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.glpVaultRouter()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGlpVaultRouter(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGlpVaultRouter(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid glpVaultRouter address');
        });
    });
    describe('#ownerSetWhitelistController', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetWhitelistController(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'WhitelistControllerSet', {
                whitelistController: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.whitelistController()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetWhitelistController(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetWhitelistController(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid whitelist address');
        });
    });
    describe('#ownerSetUsdcReceiptToken', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetUsdcReceiptToken(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'UsdcReceiptTokenSet', {
                usdcReceiptToken: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.usdcReceiptToken()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetUsdcReceiptToken(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetUsdcReceiptToken(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid usdcReceiptToken address');
        });
    });
    describe('#ownerSetJUSDC', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetJUSDC(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'JUSDCSet', {
                jUSDC: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.jUSDC()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetJUSDC(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetJUSDC(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid jUSDC address');
        });
    });
    describe('#ownerSetUnwrapperTrader', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetUnwrapperTrader(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(registry, result, 'UnwrapperTraderSet', {
                unwrapperTrader: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await registry.unwrapperTrader()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetUnwrapperTrader(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetUnwrapperTrader(Addresses_1.ZERO_ADDRESS), 'JonesUSDCRegistry: Invalid unwrapperTrader address');
        });
    });
});

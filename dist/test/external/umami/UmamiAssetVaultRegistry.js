"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const umami_1 = require("../../utils/ecosystem-token-utils/umami");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('UmamiAssetVaultRegistry', () => {
    let snapshotId;
    let core;
    let registry;
    let unwrapper;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        registry = await (0, umami_1.createUmamiAssetVaultRegistry)(core);
        const userVaultImplementation = await (0, umami_1.createUmamiAssetVaultIsolationModeTokenVaultV1)();
        const factory = await (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, registry, core.umamiEcosystem.glpUsdc, core.tokens.usdc, userVaultImplementation);
        unwrapper = await (0, umami_1.createUmamiAssetVaultIsolationModeUnwrapperTraderV2)(core, registry, factory);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#initializer', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await registry.storageViewer()).to.equal(core.umamiEcosystem.storageViewer.address);
            (0, chai_1.expect)(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
        });
        it('should fail if already initialized', async () => {
            await (0, assertions_1.expectThrow)(registry.initialize(core.umamiEcosystem.storageViewer.address, core.dolomiteRegistry.address), 'Initializable: contract is already initialized');
        });
    });
    describe('#ownerSetStorageViewer', () => {
        it('should work normally', async () => {
            const result = await registry.connect(core.governance).ownerSetStorageViewer(core.umamiEcosystem.storageViewer.address);
            await (0, assertions_1.expectEvent)(registry, result, 'StorageViewerSet', {
                storageViewer: core.umamiEcosystem.storageViewer.address,
            });
            (0, chai_1.expect)(await registry.storageViewer()).to.equal(core.umamiEcosystem.storageViewer.address);
        });
        it('should fail if storageViewer is invalid', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetStorageViewer(OTHER_ADDRESS), `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetStorageViewer(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetStorageViewer(Addresses_1.ZERO_ADDRESS), 'UmamiAssetVaultRegistry: Invalid storageViewer address');
        });
    });
});

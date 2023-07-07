"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const dolomite_1 = require("../../utils/dolomite");
const setup_1 = require("../../utils/setup");
describe('RegistryProxy', () => {
    let snapshotId;
    let core;
    let implementation;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        implementation = await (0, dolomite_1.createDolomiteRegistryImplementation)();
        const calldata = await implementation.populateTransaction.initialize(core.genericTraderProxy.address);
        registry = await (0, dolomite_1.createRegistryProxy)(implementation.address, calldata.data, core);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#upgradeTo', () => {
        it('should work normally', async () => {
            const newImplementation = await (0, dolomite_1.createDolomiteRegistryImplementation)();
            await (0, assertions_1.expectEvent)(registry, await registry.connect(core.governance).upgradeTo(newImplementation.address), 'ImplementationSet', { newImplementation: newImplementation.address });
            (0, chai_1.expect)(await registry.implementation()).to.equal(newImplementation.address);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).upgradeTo(implementation.address), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when new implementation is not a contract', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).upgradeTo(core.hhUser1.address), 'RegistryProxy: Implementation is not a contract');
        });
    });
    describe('#upgradeToAndCall', () => {
        it('should work normally', async () => {
            const newImplementation = await (0, dolomite_1.createDolomiteRegistryImplementation)();
            const calldata = await newImplementation.populateTransaction.ownerSetGenericTraderProxy(core.genericTraderProxy.address);
            await (0, assertions_1.expectEvent)(registry, await registry.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data), 'ImplementationSet', { newImplementation: newImplementation.address });
            (0, chai_1.expect)(await registry.implementation()).to.equal(newImplementation.address);
        });
        it('should fail when not called by owner', async () => {
            const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(core.genericTraderProxy.address);
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when new implementation is not a contract', async () => {
            const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(core.genericTraderProxy.address);
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data), 'RegistryProxy: Implementation is not a contract');
        });
        it('should fail when call to the new implementation fails', async () => {
            const newImplementation = await (0, dolomite_1.createDolomiteRegistryImplementation)();
            const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(core.dolomiteMargin.address);
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data), `ValidationLib: Call to target failed <${core.dolomiteMargin.address.toLowerCase()}>`);
        });
    });
});

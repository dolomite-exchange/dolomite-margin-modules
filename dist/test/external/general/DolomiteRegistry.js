"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const dolomite_1 = require("../../utils/dolomite");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('DolomiteRegistryImplementation', () => {
    let snapshotId;
    let core;
    let implementation;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        implementation = await (0, dolomite_1.createDolomiteRegistryImplementation)();
        const calldata = await implementation.populateTransaction.initialize(core.genericTraderProxy.address);
        const registryProxy = await (0, dolomite_1.createRegistryProxy)(implementation.address, calldata.data, core);
        registry = types_1.DolomiteRegistryImplementation__factory.connect(registryProxy.address, core.governance);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await registry.genericTraderProxy()).to.equal(core.genericTraderProxy.address);
        });
        it('should fail to initialize if already initialized', async () => {
            await (0, assertions_1.expectThrow)(registry.initialize(core.genericTraderProxy.address), 'Initializable: contract is already initialized');
        });
    });
    describe('#ownerSetGenericTraderProxy', () => {
        it('should work normally', async () => {
            const genericTraderProxy = core.genericTraderProxy.address;
            const result = await registry.connect(core.governance).ownerSetGenericTraderProxy(genericTraderProxy);
            await (0, assertions_1.expectEvent)(registry, result, 'GenericTraderProxySet', {
                genericTraderProxy,
            });
            (0, chai_1.expect)(await registry.genericTraderProxy()).to.equal(genericTraderProxy);
        });
        it('should fail if genericTraderProxy is invalid', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGenericTraderProxy(OTHER_ADDRESS), `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.hhUser1).ownerSetGenericTraderProxy(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if zero address is set', async () => {
            await (0, assertions_1.expectThrow)(registry.connect(core.governance).ownerSetGenericTraderProxy(Addresses_1.ZERO_ADDRESS), 'DolomiteRegistryImplementation: Invalid genericTraderProxy');
        });
    });
});

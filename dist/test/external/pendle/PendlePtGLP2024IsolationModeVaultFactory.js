"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const pendle_1 = require("../../utils/ecosystem-token-utils/pendle");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('PendlePtGLP2024IsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let pendleRegistry;
    let vaultImplementation;
    let factory;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        pendleRegistry = await (0, pendle_1.createPendlePtGLP2024Registry)(core);
        vaultImplementation = await (0, pendle_1.createPendlePtGLP2024IsolationModeTokenVaultV1)();
        factory = await (0, pendle_1.createPendlePtGLP2024IsolationModeVaultFactory)(core, pendleRegistry, core.pendleEcosystem.ptGlpToken, vaultImplementation);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await factory.pendlePtGLP2024Registry()).to.equal(pendleRegistry.address);
            (0, chai_1.expect)(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem.ptGlpToken.address);
            (0, chai_1.expect)(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
            (0, chai_1.expect)(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
            (0, chai_1.expect)(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });
    describe('#ownerSetPendlePtGLP2024Registry', () => {
        it('should work normally', async () => {
            const result = await factory.connect(core.governance).ownerSetPendlePtGLP2024Registry(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(factory, result, 'PendlePtGLP2024RegistrySet', {
                pendlePtGLP2024Registry: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await factory.pendlePtGLP2024Registry()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).ownerSetPendlePtGLP2024Registry(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#allowableCollateralMarketIds', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
        });
    });
    describe('#allowableDebtMarketIds', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await factory.allowableDebtMarketIds()).to.deep.equal([]);
        });
    });
});

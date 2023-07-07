"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const setup_1 = require("../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('PlutusVaultGLPIsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let plutusVaultRegistry;
    let vaultImplementation;
    let factory;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        vaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPIsolationModeTokenVaultV1__factory.abi, types_1.TestGLPIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, core.plutusEcosystem.plvGlp, vaultImplementation);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await factory.plutusVaultRegistry()).to.equal(plutusVaultRegistry.address);
            (0, chai_1.expect)(await factory.UNDERLYING_TOKEN()).to.equal(core.plutusEcosystem.plvGlp.address);
            (0, chai_1.expect)(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
            (0, chai_1.expect)(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
            (0, chai_1.expect)(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });
    describe('#ownerSetPlutusVaultRegistry', () => {
        it('should work normally', async () => {
            const result = await factory.connect(core.governance).ownerSetPlutusVaultRegistry(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(factory, result, 'PlutusVaultRegistrySet', {
                plutusVaultRegistry: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await factory.plutusVaultRegistry()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).ownerSetPlutusVaultRegistry(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
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

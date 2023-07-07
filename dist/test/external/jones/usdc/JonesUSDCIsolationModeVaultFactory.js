"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
const setup_1 = require("../../../utils/setup");
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('JonesUSDCIsolationModeVaultFactory', () => {
    let snapshotId;
    let core;
    let jonesUSDCRegistry;
    let vaultImplementation;
    let factory;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        vaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPIsolationModeTokenVaultV1__factory.abi, types_1.TestGLPIsolationModeTokenVaultV1__factory.bytecode, []);
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, core.jonesEcosystem.jUSDC, vaultImplementation);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await factory.jonesUSDCRegistry()).to.equal(jonesUSDCRegistry.address);
            (0, chai_1.expect)(await factory.UNDERLYING_TOKEN()).to.equal(core.jonesEcosystem.jUSDC.address);
            (0, chai_1.expect)(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
            (0, chai_1.expect)(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
            (0, chai_1.expect)(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });
    describe('#ownerSetJonesUSDCRegistry', () => {
        it('should work normally', async () => {
            const result = await factory.connect(core.governance).ownerSetJonesUSDCRegistry(OTHER_ADDRESS);
            await (0, assertions_1.expectEvent)(factory, result, 'JonesUSDCRegistrySet', {
                jonesUSDCRegistry: OTHER_ADDRESS,
            });
            (0, chai_1.expect)(await factory.jonesUSDCRegistry()).to.equal(OTHER_ADDRESS);
        });
        it('should fail when not called by owner', async () => {
            await (0, assertions_1.expectThrow)(factory.connect(core.hhUser1).ownerSetJonesUSDCRegistry(OTHER_ADDRESS), `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#allowableCollateralMarketIds', () => {
        it('should work normally', async () => {
            const result = await factory.allowableCollateralMarketIds();
            (0, chai_1.expect)(result.length).to.eql(1);
            (0, chai_1.expect)(result[0]).to.eq(no_deps_constants_1.NONE_MARKET_ID);
        });
    });
    describe('#allowableDebtMarketIds', () => {
        it('should work normally', async () => {
            const result = await factory.allowableDebtMarketIds();
            (0, chai_1.expect)(result.length).to.eql(1);
            (0, chai_1.expect)(result[0].toNumber()).to.eq(core.marketIds.usdc);
        });
    });
});

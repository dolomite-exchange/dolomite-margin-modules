"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const gmx_1 = require("../../utils/ecosystem-token-utils/gmx");
const setup_1 = require("../../utils/setup");
const GLP_PRICE = ethers_1.BigNumber.from('913711474561791281'); // $0.913711
describe('GLPPriceOracleV1', () => {
    let snapshotId;
    let glpPriceOracle;
    let gmxRegistry;
    before(async () => {
        const core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 53107700,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        gmxRegistry = await (0, gmx_1.createGmxRegistry)(core);
        const userVaultImplementation = await (0, gmx_1.createGLPIsolationModeTokenVaultV1)();
        const factory = await (0, gmx_1.createGLPIsolationModeVaultFactory)(core, gmxRegistry, userVaultImplementation);
        glpPriceOracle = await (0, gmx_1.createGLPPriceOracleV1)(factory, gmxRegistry);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#getPrice', () => {
        it('returns the correct value under the correct conditions for dsGLP', async () => {
            const dfsGlp = await glpPriceOracle.DFS_GLP();
            const price = await glpPriceOracle.getPrice(dfsGlp);
            (0, chai_1.expect)(price.value).to.eq(GLP_PRICE);
        });
        it('fails when token sent is not dsGLP', async () => {
            await (0, assertions_1.expectThrow)(glpPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.ZERO), 'GLPPriceOracleV1: invalid token');
            await (0, assertions_1.expectThrow)(glpPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.TEST_UNISWAP), 'GLPPriceOracleV1: invalid token');
            await (0, assertions_1.expectThrow)(glpPriceOracle.getPrice(await gmxRegistry.glp()), 'GLPPriceOracleV1: invalid token');
        });
    });
});

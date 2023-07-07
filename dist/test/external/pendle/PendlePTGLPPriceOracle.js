"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const pendle_1 = require("../../utils/ecosystem-token-utils/pendle");
const setup_1 = require("../../utils/setup");
/**
 * This is the expected price at the following timestamp: 1683002000
 *
 * Keep in mind that Pendle's prices tick upward each second.
 */
const PT_GLP_PRICE = ethers_1.BigNumber.from('811223271259012781'); // $0.811223271259012781
describe('PendlePtGLPPriceOracle', () => {
    let snapshotId;
    let core;
    let ptGlpOracle;
    let pendleRegistry;
    let factory;
    let unwrapperTrader;
    let marketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        pendleRegistry = await (0, pendle_1.createPendlePtGLP2024Registry)(core);
        const userVaultImplementation = await (0, pendle_1.createPendlePtGLP2024IsolationModeTokenVaultV1)();
        factory = await (0, pendle_1.createPendlePtGLP2024IsolationModeVaultFactory)(core, pendleRegistry, core.pendleEcosystem.ptGlpToken, userVaultImplementation);
        unwrapperTrader = await (0, pendle_1.createPendlePtGLP2024IsolationModeUnwrapperTraderV2)(core, factory, pendleRegistry);
        ptGlpOracle = await (0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry);
        marketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, ptGlpOracle);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('constructor', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await ptGlpOracle.DPT_GLP()).to.eq(factory.address);
            (0, chai_1.expect)(await ptGlpOracle.REGISTRY()).to.eq(pendleRegistry.address);
            (0, chai_1.expect)(await ptGlpOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
            (0, chai_1.expect)(await ptGlpOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
        });
        it('should fail when oracle is not ready yet', async () => {
            const testPtOracle = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestPendlePtOracle__factory.abi, types_1.TestPendlePtOracle__factory.bytecode, []);
            await pendleRegistry.connect(core.governance).ownerSetPtOracle(testPtOracle.address);
            await testPtOracle.setOracleState(true, 0, false);
            await (0, assertions_1.expectThrow)((0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry), 'PendlePtGLPPriceOracle: Oracle not ready yet');
            await testPtOracle.setOracleState(false, 0, false);
            await (0, assertions_1.expectThrow)((0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry), 'PendlePtGLPPriceOracle: Oracle not ready yet');
            await testPtOracle.setOracleState(true, 0, true);
            await (0, assertions_1.expectThrow)((0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry), 'PendlePtGLPPriceOracle: Oracle not ready yet');
            await testPtOracle.setOracleState(false, 0, true);
            await (0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry); // should work now
        });
    });
    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for dptGLP', async () => {
            await (0, utils_1.increaseToTimestamp)(1683002000);
            const price = await ptGlpOracle.getPrice(factory.address);
            (0, chai_1.expect)(price.value).to.eq(PT_GLP_PRICE);
        });
        it('fails when token sent is not dptGLP', async () => {
            await (0, assertions_1.expectThrow)(ptGlpOracle.getPrice(dolomite_margin_1.ADDRESSES.ZERO), `PendlePtGLPPriceOracle: invalid token <${dolomite_margin_1.ADDRESSES.ZERO}>`);
            await (0, assertions_1.expectThrow)(ptGlpOracle.getPrice(core.gmxEcosystem.fsGlp.address), `PendlePtGLPPriceOracle: invalid token <${core.gmxEcosystem.fsGlp.address.toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(ptGlpOracle.getPrice(core.tokens.dfsGlp.address), `PendlePtGLPPriceOracle: invalid token <${(core.tokens.dfsGlp.address).toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(ptGlpOracle.getPrice(core.gmxEcosystem.glp.address), `PendlePtGLPPriceOracle: invalid token <${core.gmxEcosystem.glp.address.toLowerCase()}>`);
        });
        it('fails when ptGLP is borrowable', async () => {
            await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
            await (0, assertions_1.expectThrow)(ptGlpOracle.getPrice(factory.address), 'PendlePtGLPPriceOracle: ptGLP cannot be borrowable');
        });
    });
});

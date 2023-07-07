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
const abracadabra_1 = require("../../utils/ecosystem-token-utils/abracadabra");
const setup_1 = require("../../utils/setup");
const GLP_PRICE = ethers_1.BigNumber.from('1000974796933941049'); // $1.000974796933941049
describe('MagicGLPPriceOracle', () => {
    let snapshotId;
    let magicGlpPriceOracle;
    let magicGlpPriceOracleWithNoTotalSupply;
    let magicGlp;
    let magicGlpWithNoTotalSupply;
    let core;
    before(async () => {
        const network = no_deps_constants_1.Network.ArbitrumOne;
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 81874000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        magicGlp = core.abraEcosystem.magicGlp;
        magicGlpWithNoTotalSupply = await (0, dolomite_utils_1.createTestToken)();
        magicGlpPriceOracle = await (0, abracadabra_1.createMagicGLPPriceOracle)(core);
        magicGlpPriceOracleWithNoTotalSupply = await (0, dolomite_utils_1.createContractWithAbi)(types_1.MagicGLPPriceOracle__factory.abi, types_1.MagicGLPPriceOracle__factory.bytecode, [core.dolomiteMargin.address, magicGlpWithNoTotalSupply.address, core.marketIds.dfsGlp]);
        await (0, setup_1.setupTestMarket)(core, magicGlp, true, magicGlpPriceOracle);
        await (0, setup_1.setupTestMarket)(core, magicGlpWithNoTotalSupply, true, magicGlpPriceOracleWithNoTotalSupply);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#DOLOMITE_MARGIN', () => {
        it('returns the correct value', async () => {
            (0, chai_1.expect)(await magicGlpPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
        });
    });
    describe('#MAGIC_GLP', () => {
        it('returns the correct value', async () => {
            (0, chai_1.expect)(await magicGlpPriceOracle.MAGIC_GLP()).to.eq(magicGlp.address);
        });
    });
    describe('#DFS_GLP_MARKET_ID', () => {
        it('returns the correct value', async () => {
            (0, chai_1.expect)(await magicGlpPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
        });
    });
    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for magicGLP', async () => {
            const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp);
            (0, chai_1.expect)(glpPrice.value).to.eq(GLP_PRICE);
            const balance = await core.gmxEcosystem.fsGlp.balanceOf(magicGlp.address);
            const totalSupply = await magicGlp.totalSupply();
            (0, chai_1.expect)((await magicGlpPriceOracle.getPrice(magicGlp.address)).value)
                .to
                .eq(glpPrice.value.mul(balance).div(totalSupply));
        });
        it('returns the correct value when magicGLP total supply is 0', async () => {
            const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp);
            (0, chai_1.expect)(glpPrice.value).to.eq(GLP_PRICE);
            const totalSupply = await magicGlpWithNoTotalSupply.totalSupply();
            (0, chai_1.expect)(totalSupply).to.eq(0);
            (0, chai_1.expect)((await magicGlpPriceOracleWithNoTotalSupply.getPrice(magicGlpWithNoTotalSupply.address)).value)
                .to
                .eq(glpPrice.value);
        });
        it('fails when token sent is not magicGLP', async () => {
            await (0, assertions_1.expectThrow)(magicGlpPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.ZERO), `MagicGLPPriceOracle: invalid token <${dolomite_margin_1.ADDRESSES.ZERO}>`);
            await (0, assertions_1.expectThrow)(magicGlpPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.TEST_UNISWAP), `MagicGLPPriceOracle: invalid token <${dolomite_margin_1.ADDRESSES.TEST_UNISWAP.toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(magicGlpPriceOracle.getPrice(core.gmxEcosystem.glp.address), `MagicGLPPriceOracle: invalid token <${core.gmxEcosystem.glp.address.toLowerCase()}>`);
        });
        it('fails when magicGLP is borrowable', async () => {
            await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.marketIds.magicGlp, false);
            await (0, assertions_1.expectThrow)(magicGlpPriceOracle.getPrice(magicGlp.address), 'MagicGLPPriceOracle: magicGLP cannot be borrowable');
        });
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const setup_1 = require("../../utils/setup");
const GLP_PRICE = ethers_1.BigNumber.from('951856689348643550'); // $0.95185668
const PLV_GLP_PRICE = ethers_1.BigNumber.from('1122820703434687401'); // $1.12282070
describe('PlutusVaultGLPPriceOracle', () => {
    let snapshotId;
    let core;
    let plvGlpPriceOracle;
    let plutusVaultRegistry;
    let factory;
    let unwrapperTrader;
    let marketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        const userVaultImplementation = await (0, plutus_1.createPlutusVaultGLPIsolationModeTokenVaultV1)();
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, core.plutusEcosystem.plvGlp, userVaultImplementation);
        unwrapperTrader = await (0, plutus_1.createPlutusVaultGLPIsolationModeUnwrapperTraderV1)(core, plutusVaultRegistry, factory);
        plvGlpPriceOracle = await (0, plutus_1.createPlutusVaultGLPPriceOracle)(core, plutusVaultRegistry, factory, unwrapperTrader);
        marketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, plvGlpPriceOracle);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for dplvGLP', async () => {
            const price = await plvGlpPriceOracle.getPrice(factory.address);
            (0, chai_1.expect)(price.value).to.eq(PLV_GLP_PRICE);
        });
        it('returns the correct value plvGLP has a total supply of 0', async () => {
            const testToken = await (0, dolomite_utils_1.createTestToken)();
            await plutusVaultRegistry.connect(core.governance).ownerSetPlvGlpToken(testToken.address);
            const price = await plvGlpPriceOracle.getPrice(factory.address);
            (0, chai_1.expect)(price.value).to.eq(GLP_PRICE);
        });
        it('fails when token sent is not dplvGLP', async () => {
            await (0, assertions_1.expectThrow)(plvGlpPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.ZERO), `PlutusVaultGLPPriceOracle: invalid token <${dolomite_margin_1.ADDRESSES.ZERO}>`);
            await (0, assertions_1.expectThrow)(plvGlpPriceOracle.getPrice(core.gmxEcosystem.fsGlp.address), `PlutusVaultGLPPriceOracle: invalid token <${core.gmxEcosystem.fsGlp.address.toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(plvGlpPriceOracle.getPrice(core.tokens.dfsGlp.address), `PlutusVaultGLPPriceOracle: invalid token <${(core.tokens.dfsGlp.address).toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(plvGlpPriceOracle.getPrice(core.gmxEcosystem.glp.address), `PlutusVaultGLPPriceOracle: invalid token <${core.gmxEcosystem.glp.address.toLowerCase()}>`);
        });
        it('fails when plvGLP is borrowable', async () => {
            await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
            await (0, assertions_1.expectThrow)(plvGlpPriceOracle.getPrice(factory.address), 'PlutusVaultGLPPriceOracle: plvGLP cannot be borrowable');
        });
    });
});

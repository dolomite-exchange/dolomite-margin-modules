"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const gmx_1 = require("../../utils/ecosystem-token-utils/gmx");
const setup_1 = require("../../utils/setup");
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const usdcAmount = ethers_1.BigNumber.from('10000000'); // $10
const glpAmount = ethers_1.BigNumber.from('5000000000000000000'); // 5 GLP
describe('GLPMathLib', () => {
    let snapshotId;
    let core;
    let lib;
    let registry;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        registry = await (0, gmx_1.createGmxRegistry)(core);
        lib = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPMathLib__factory.abi, types_1.TestGLPMathLib__factory.bytecode, [registry.address]);
        const usdcBigAmount = amountWei.div(1e12).mul(4);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcBigAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#getUsdgAmountForBuy && #getGlpMintAmount', () => {
        it('should work when AUM is greater than 0', async () => {
            for (let i = 0; i < 10; i++) {
                // generate a random number between 1 and 99
                const random = Math.floor(Math.random() * 99) + 1;
                const weirdAmountUsdc = usdcAmount.mul(random).div(101);
                const usdgAmount = await lib.GLPMathLibGetUsdgAmountForBuy(core.tokens.usdc.address, weirdAmountUsdc);
                const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                    .callStatic
                    .mintAndStakeGlp(core.tokens.usdc.address, weirdAmountUsdc, 0, 0);
                (0, chai_1.expect)(await lib.GLPMathLibGetGlpMintAmount(usdgAmount)).to.eq(expectedAmount);
            }
        });
        it('should work when AUM is 0', async () => {
            const testGLPManager = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPManager__factory.abi, types_1.TestGLPManager__factory.bytecode, []);
            await registry.connect(core.governance).ownerSetGlpManager(testGLPManager.address);
            await testGLPManager.setAumInUsdg(0);
            for (let i = 0; i < 10; i++) {
                const random = Math.floor(Math.random() * 99) + 1;
                const weirdAmountUsdg = usdcAmount.mul(random).div(101);
                (0, chai_1.expect)(await lib.GLPMathLibGetGlpMintAmount(weirdAmountUsdg)).to.eq(weirdAmountUsdg);
            }
        });
        it('should work when total supply is 0', async () => {
            const glp = await (0, dolomite_utils_1.createTestToken)();
            await registry.connect(core.governance).ownerSetGlp(glp.address);
            (0, chai_1.expect)(await glp.totalSupply()).to.eq(no_deps_constants_1.ZERO_BI);
            for (let i = 0; i < 10; i++) {
                const random = Math.floor(Math.random() * 99) + 1;
                const weirdAmountUsdg = usdcAmount.mul(random).div(101);
                (0, chai_1.expect)(await lib.GLPMathLibGetGlpMintAmount(weirdAmountUsdg)).to.eq(weirdAmountUsdg);
            }
        });
        it('should fail when input amount is 0', async () => {
            await (0, assertions_1.expectThrow)(lib.GLPMathLibGetUsdgAmountForBuy(core.tokens.usdc.address, no_deps_constants_1.ZERO_BI), 'GLPMathLib: Input amount must be gt than 0');
        });
    });
    describe('#getUsdgAmountForSell && #getGlpRedemptionAmount', () => {
        it('should work when AUM is greater than 0', async () => {
            for (let i = 0; i < 10; i++) {
                // generate a random number between 1 and 99
                const random = Math.floor(Math.random() * 99) + 1;
                const weirdAmountGlp = glpAmount.mul(random).div(101);
                const usdgAmount = await lib.GLPMathLibGetUsdgAmountForSell(weirdAmountGlp);
                const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                    .callStatic
                    .unstakeAndRedeemGlp(core.tokens.usdc.address, weirdAmountGlp, 0, core.hhUser1.address);
                (0, chai_1.expect)(await lib.GLPMathLibGetGlpRedemptionAmount(core.tokens.usdc.address, usdgAmount)).to.eq(expectedAmount);
            }
        });
    });
    describe('#basisPointsDivisor', () => {
        it('should apply fees to an amount', async () => {
            (0, chai_1.expect)(await lib.GLPMathLibBasisPointsDivisor()).to.eq(10000);
        });
    });
    describe('#pricePrecision', () => {
        it('should apply fees to an amount', async () => {
            (0, chai_1.expect)(await lib.GLPMathLibPricePrecision()).to.eq('1000000000000000000000000000000');
        });
    });
    describe('#applyFeesToAmount', () => {
        it('should apply fees to an amount', async () => {
            const amount = 1000;
            const fee = 10;
            const expected = 999;
            (0, chai_1.expect)(await lib.GLPMathLibApplyFeesToAmount(amount, fee)).to.eq(expected);
        });
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const abracadabra_1 = require("../../utils/ecosystem-token-utils/abracadabra");
const setup_1 = require("../../utils/setup");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('MagicGLPWrapperTraderV1', () => {
    let snapshotId;
    let core;
    let magicGlp;
    let marketId;
    let wrapper;
    let magicGlpPriceOracle;
    let defaultAccount;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        magicGlp = core.abraEcosystem.magicGlp;
        magicGlpPriceOracle = await (0, abracadabra_1.createMagicGLPPriceOracle)(core);
        marketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, magicGlp, true, magicGlpPriceOracle);
        wrapper = await (0, abracadabra_1.createMagicGLPWrapperTraderV1)(core);
        defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };
        // setting the interest rate to 0 makes calculations more consistent
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.usdc);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
        await core.tokens.usdc.connect(core.hhUser1).approve(core.gmxEcosystem.glpManager.address, usdcAmount);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc, usableUsdcAmount);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Exchange for non-liquidation sale', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, marketId, core.marketIds.usdc, no_deps_constants_1.ZERO_BI, usableUsdcAmount);
            const amountOut = await wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(amountOut);
            (0, chai_1.expect)(underlyingBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(await magicGlp.balanceOf(core.dolomiteMargin.address)).to.eq(amountOut);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when output token is not magicGLP', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            await (0, assertions_1.expectThrow)(wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, core.marketIds.weth, core.marketIds.usdc, no_deps_constants_1.ZERO_BI, usableUsdcAmount), `MagicGLPWrapperTraderV1: Invalid output market <${core.marketIds.weth.toString()}>`);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(wrapper.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, magicGlp.address, core.tokens.usdc.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is not compatible with GLP', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, magicGlp.address, core.tokens.dfsGlp.address, usableUsdcAmount, abiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), `MagicGLPWrapperTraderV1: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `MagicGLPWrapperTraderV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if input amount is 0', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, magicGlp.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, abiCoder.encode(['uint256'], [otherAmountWei])), 'MagicGLPWrapperTraderV1: Invalid input amount');
        });
    });
    describe('#MAGIC_GLP', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.MAGIC_GLP()).to.eq(magicGlp.address);
        });
    });
    describe('#GMX_REGISTRY', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.GMX_REGISTRY()).to.eq(core.gmxEcosystem.live.gmxRegistry.address);
        });
    });
    describe('#actionsLength', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.actionsLength()).to.eq(1);
        });
    });
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const inputAmount = usableUsdcAmount;
            const glpAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                .callStatic
                .mintAndStakeGlp(core.tokens.usdc.address, inputAmount, 1, 1);
            const expectedAmount = await magicGlp.convertToShares(glpAmount);
            (0, chai_1.expect)(await wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, inputAmount, no_deps_constants_1.BYTES_EMPTY))
                .to
                .eq(expectedAmount);
        });
        it('should work for 10 random numbers, as long as balance is sufficient', async () => {
            for (let i = 0; i < 10; i++) {
                // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
                const randomNumber = ethers_1.BigNumber.from(Math.floor(Math.random() * 99) + 1);
                const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
                const glpAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                    .callStatic
                    .mintAndStakeGlp(core.tokens.usdc.address, weirdAmount, 1, 1);
                const expectedAmount = await magicGlp.convertToShares(glpAmount);
                (0, chai_1.expect)(await wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedAmount);
            }
        });
        it('should fail if the input token is not in GLP', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(core.tokens.dfsGlp.address, magicGlp.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `MagicGLPWrapperTraderV1: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if the output token is not dfsGLP', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(core.tokens.usdc.address, core.tokens.weth.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `MagicGLPWrapperTraderV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the input amount is 0', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), 'MagicGLPWrapperTraderV1: Invalid desired input amount');
        });
    });
});

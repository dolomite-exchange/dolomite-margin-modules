"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
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
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('MagicGLPUnwrapperTraderV1', () => {
    let snapshotId;
    let core;
    let magicGlp;
    let marketId;
    let unwrapper;
    let priceOracle;
    let defaultAccount;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        magicGlp = core.abraEcosystem.magicGlp;
        priceOracle = await (0, abracadabra_1.createMagicGLPPriceOracle)(core);
        marketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, magicGlp, true, priceOracle);
        unwrapper = await (0, abracadabra_1.createMagicGLPUnwrapperTraderV1)(core);
        defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };
        const usdcAmount = amountWei.div(1e12).mul(4);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(magicGlp.address, amountWei.mul(2));
        await magicGlp.connect(core.hhUser1).mint(amountWei, core.hhUser1.address);
        await magicGlp.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccount.number, marketId, amountWei, core.hhUser1.address);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.eq(amountWei);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Actions.Sell for non-liquidation', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await unwrapper.createActionsForUnwrappingForLiquidation(solidAccountId, liquidAccountId, dolomite_margin_1.ADDRESSES.ZERO, dolomite_margin_1.ADDRESSES.ZERO, core.marketIds.usdc, marketId, no_deps_constants_1.ZERO_BI, amountWei);
            (0, chai_1.expect)(actions.length).to.eql(1);
            const amountOut = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await magicGlp.balanceOf(core.dolomiteMargin.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(amountOut);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, magicGlp.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, core.tokens.weth.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `MagicGLPUnwrapperTraderV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.gmxEcosystem.sGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, magicGlp.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `MagicGLPUnwrapperTraderV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the input amount is 0', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.gmxEcosystem.sGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, magicGlp.address, no_deps_constants_1.ZERO_BI, abiCoder.encode(['uint256'], [otherAmountWei])), 'MagicGLPUnwrapperTraderV1: Invalid input amount');
        });
    });
    describe('#token', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.token()).to.eq(magicGlp.address);
        });
    });
    describe('#outputMarketId', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.outputMarketId()).to.eq(core.marketIds.usdc);
        });
    });
    describe('#actionsLength', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.actionsLength()).to.eq(1);
        });
    });
    describe('#gmxRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.GMX_REGISTRY()).to.eq(core.gmxEcosystem.live.gmxRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should be greater than oracle price for $10M redemption', async () => {
            const ONE_WEI = ethers_1.BigNumber.from('1000000000000000000');
            const TEN_MILLION = ethers_1.BigNumber.from('10000000');
            const amount = ONE_WEI.mul(TEN_MILLION);
            const decimalDelta = ethers_1.BigNumber.from('1000000000000');
            const outputAmount = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, amount, no_deps_constants_1.BYTES_EMPTY);
            const oraclePrice = (await priceOracle.getPrice(magicGlp.address)).value.div(decimalDelta);
            // the effective price should be greater than the oracle price and less than the oracle price + 0.75%
            (0, chai_1.expect)(outputAmount.div(TEN_MILLION)).to.be.gt(oraclePrice);
            (0, chai_1.expect)(outputAmount.div(TEN_MILLION)).to.be.lt(oraclePrice.mul('10075').div('10000'));
        });
        it('should work normally', async () => {
            const glpAmount = await magicGlp.convertToAssets(amountWei);
            const expectedUsdcAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                .callStatic
                .unstakeAndRedeemGlp(core.tokens.usdc.address, glpAmount, 1, core.hhUser1.address);
            (0, chai_1.expect)(await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY))
                .to
                .eq(expectedUsdcAmount);
        });
        it('should work for 10 random numbers, as long as balance is sufficient', async () => {
            for (let i = 0; i < 10; i++) {
                // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
                const randomNumber = ethers_1.BigNumber.from(Math.floor(Math.random() * 99) + 1);
                const weirdAmount = amountWei.mul(randomNumber).div(101);
                const glpAmount = await magicGlp.convertToAssets(weirdAmount);
                const expectedUsdcAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                    .callStatic
                    .unstakeAndRedeemGlp(core.tokens.usdc.address, glpAmount, 1, core.hhUser1.address);
                (0, chai_1.expect)(await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedUsdcAmount);
            }
        });
        it('should fail if the input token is not dsfGLP', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `MagicGLPUnwrapperTraderV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the output token is not USDC', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(magicGlp.address, core.tokens.weth.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `MagicGLPUnwrapperTraderV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the input token is not 0', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), 'MagicGLPUnwrapperTraderV1: Invalid desired input amount');
        });
    });
});

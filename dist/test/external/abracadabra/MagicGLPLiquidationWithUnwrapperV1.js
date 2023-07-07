"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const abracadabra_1 = require("../../utils/ecosystem-token-utils/abracadabra");
const expiry_utils_1 = require("../../utils/expiry-utils");
const liquidation_utils_1 = require("../../utils/liquidation-utils");
const setup_1 = require("../../utils/setup");
const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const minCollateralizationNumerator = ethers_1.BigNumber.from('120');
const minCollateralizationDenominator = ethers_1.BigNumber.from('100');
const liquidationSpreadNumerator = ethers_1.BigNumber.from('105');
const liquidationSpreadDenominator = ethers_1.BigNumber.from('100');
const expirationCollateralizationNumerator = ethers_1.BigNumber.from('150');
const expirationCollateralizationDenominator = ethers_1.BigNumber.from('100');
describe('MagicGLPLiquidationWithUnwrapperV1', () => {
    let snapshotId;
    let core;
    let magicGlp;
    let heldMarketId;
    let unwrapper;
    let priceOracle;
    let defaultAccountStruct;
    let liquidAccountStruct;
    let solidAccountStruct;
    before(async () => {
        const blockNumber = await (0, utils_1.getRealLatestBlockNumber)(true, no_deps_constants_1.Network.ArbitrumOne);
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        magicGlp = core.abraEcosystem.magicGlp;
        priceOracle = await (0, abracadabra_1.createMagicGLPPriceOracle)(core);
        heldMarketId = ethers_1.BigNumber.from(core.marketIds.magicGlp);
        unwrapper = await (0, abracadabra_1.createMagicGLPUnwrapperTraderV1)(core);
        defaultAccountStruct = { owner: core.hhUser1.address, number: defaultAccountNumber };
        liquidAccountStruct = { owner: core.hhUser1.address, number: otherAccountNumber };
        solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };
        const usdcAmount = heldAmountWei.div(1e12).mul(4);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(magicGlp.address, heldAmountWei.mul(2));
        await magicGlp.connect(core.hhUser1).mint(heldAmountWei, core.hhUser1.address);
        await magicGlp.connect(core.hhUser1).approve(core.dolomiteMargin.address, heldAmountWei);
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccountStruct.number, heldMarketId, heldAmountWei, core.hhUser1.address);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, heldMarketId)).value).to.eq(heldAmountWei);
        const actualHeldAmountWei = await core.dolomiteMargin.getAccountWei(defaultAccountStruct, heldMarketId);
        (0, chai_1.expect)(actualHeldAmountWei.value).to.eq(heldAmountWei);
        (0, chai_1.expect)(actualHeldAmountWei.sign).to.eq(true);
        await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV3.address, true);
        await core.liquidatorProxyV3.connect(core.governance).setMarketIdToTokenUnwrapperForLiquidationMap(heldMarketId, unwrapper.address);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Perform liquidation with full integration', () => {
        it('should work when liquid account is borrowing the output token (USDC)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
            const usdcDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
                .div(minCollateralizationNumerator)
                .div(usdcPrice.value);
            await core.borrowPositionProxyV2.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, otherAccountNumber, heldMarketId, heldAmountWei, src_1.BalanceCheckFlag.From);
            await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(otherAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
            await core.testPriceOracle.setPrice(core.tokens.usdc.address, usdcPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator));
            await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testPriceOracle.address);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const magicGlpPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(magicGlpPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const txResult = await core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.usdc, heldMarketId, no_deps_constants_1.NO_EXPIRY, no_deps_constants_1.BYTES_EMPTY);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, magicGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.gmxEcosystem.fsGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
        it('should work when liquid account is borrowing a different output token (WETH)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
                .div(minCollateralizationNumerator)
                .div(wethPrice.value);
            await core.borrowPositionProxyV2.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, otherAccountNumber, heldMarketId, heldAmountWei, src_1.BalanceCheckFlag.From);
            await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(otherAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
            // set the price of USDC to be 105% of the current price
            await core.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator));
            await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testPriceOracle.address);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const magicGlpPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(magicGlpPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(usdcOutputAmount, core.tokens.usdc, 6, no_deps_constants_1.ONE_BI, core.tokens.weth, 18, core.hhUser5, core.liquidatorProxyV3, core);
            const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const isSuccessful = await (0, liquidation_utils_1.checkForParaswapSuccess)(core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.weth, heldMarketId, no_deps_constants_1.NO_EXPIRY, paraswapCalldata));
            if (!isSuccessful) {
                return;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, wethOutputAmount.sub(wethDebtAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, usdcLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI, wethLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.gmxEcosystem.sGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
    describe('Perform expiration with full integration', () => {
        it('should work when expired account is borrowing the output token (USDC)', async () => {
            await core.borrowPositionProxyV2.connect(core.hhUser1)
                .openBorrowPosition(defaultAccountNumber, otherAccountNumber, heldMarketId, heldAmountWei, src_1.BalanceCheckFlag.From);
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
            const usdcDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(usdcPrice.value);
            await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(otherAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
            await (0, expiry_utils_1.setExpiry)(core, liquidAccountStruct, core.marketIds.usdc, 1);
            const rampTime = await core.expiry.g_expiryRampTime();
            await (0, utils_1.waitTime)(rampTime.add(no_deps_constants_1.ONE_BI).toNumber());
            const expiry = await core.expiry.getExpiry(liquidAccountStruct, core.marketIds.usdc);
            (0, chai_1.expect)(expiry).to.not.eq(0);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is over collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .gte(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(heldMarketId, core.marketIds.usdc, expiry);
            const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const txResult = await core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.usdc, heldMarketId, expiry, no_deps_constants_1.BYTES_EMPTY);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, magicGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.gmxEcosystem.sGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
        it('should work when expired account is borrowing a different output token (WETH)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(wethPrice.value);
            await core.borrowPositionProxyV2.connect(core.hhUser1).openBorrowPosition(defaultAccountNumber, otherAccountNumber, heldMarketId, heldAmountWei, src_1.BalanceCheckFlag.From);
            await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(otherAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed over collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .gte(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const rampTime = await core.expiry.g_expiryRampTime();
            await (0, expiry_utils_1.setExpiry)(core, liquidAccountStruct, core.marketIds.weth, 1);
            await (0, utils_1.waitTime)(rampTime.add(no_deps_constants_1.ONE_BI).toNumber());
            const expiry = await core.expiry.getExpiry(liquidAccountStruct, core.marketIds.weth);
            (0, chai_1.expect)(expiry).to.not.eq(0);
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(heldMarketId, core.marketIds.weth, expiry);
            const heldUpdatedWithReward = wethDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(usdcOutputAmount, core.tokens.usdc, 6, wethDebtAmount, core.tokens.weth, 18, core.hhUser5, core.liquidatorProxyV3, core);
            const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const isSuccessful = (0, liquidation_utils_1.checkForParaswapSuccess)(core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.weth, heldMarketId, expiry, paraswapCalldata));
            if (!isSuccessful) {
                return;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, wethOutputAmount.sub(wethDebtAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, usdcLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI, wethLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.gmxEcosystem.sGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
});

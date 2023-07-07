"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dist_1 = require("@dolomite-exchange/zap-sdk/dist");
const src_1 = require("@dolomite-margin/dist/src");
const sdk_v2_1 = require("@pendle/sdk-v2");
const ChainId_1 = require("@pendle/sdk-v2/dist/common/ChainId");
const chai_1 = require("chai");
require("dotenv/config");
const ethers_1 = require("ethers");
const deployments_json_1 = __importDefault(require("../../../scripts/deployments.json"));
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const expiry_utils_1 = require("../../utils/expiry-utils");
const liquidation_utils_1 = require("../../utils/liquidation-utils");
const setup_1 = require("../../utils/setup");
const defaultAccountNumber = '0';
const borrowAccountNumber = '420';
const heldAmountWei = ethers_1.BigNumber.from('200000000000000000000'); // 200 units
const minCollateralizationNumerator = ethers_1.BigNumber.from('120');
const minCollateralizationDenominator = ethers_1.BigNumber.from('100');
const liquidationSpreadNumerator = ethers_1.BigNumber.from('105');
const liquidationSpreadDenominator = ethers_1.BigNumber.from('100');
const expirationCollateralizationNumerator = ethers_1.BigNumber.from('150');
const expirationCollateralizationDenominator = ethers_1.BigNumber.from('100');
describe('PendlePtGLP2024IsolationModeLiquidationWithZap', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let defaultAccountStruct;
    let liquidAccountStruct;
    let solidAccountStruct;
    let router;
    let zap;
    let ptGlpApiToken;
    const defaultSlippageNumerator = ethers_1.BigNumber.from('10');
    const defaultSlippageDenominator = ethers_1.BigNumber.from('10000');
    const defaultSlippage = defaultSlippageNumerator.toNumber() / defaultSlippageDenominator.toNumber();
    before(async () => {
        const blockNumber = await (0, utils_1.getRealLatestBlockNumber)(true, no_deps_constants_1.Network.ArbitrumOne);
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        const cacheDurationSeconds = 60;
        zap = new dist_1.DolomiteZap(dist_1.Network.ARBITRUM_ONE, process.env.SUBGRAPH_URL, core.hhUser1.provider, cacheDurationSeconds, defaultSlippage);
        underlyingToken = core.pendleEcosystem.ptGlpToken.connect(core.hhUser1);
        factory = types_1.PendlePtGLP2024IsolationModeVaultFactory__factory.connect(deployments_json_1.default.PendlePtGLP2024IsolationModeVaultFactory[no_deps_constants_1.Network.ArbitrumOne].address, core.hhUser1);
        unwrapper = types_1.PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.connect(deployments_json_1.default.PendlePtGLP2024IsolationModeUnwrapperTraderV2[no_deps_constants_1.Network.ArbitrumOne].address, core.hhUser1);
        wrapper = types_1.PendlePtGLP2024IsolationModeWrapperTraderV2__factory.connect(deployments_json_1.default.PendlePtGLP2024IsolationModeWrapperTraderV2[no_deps_constants_1.Network.ArbitrumOne].address, core.hhUser1);
        underlyingMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);
        ptGlpApiToken = {
            marketId: underlyingMarketId.toNumber(),
            symbol: 'PT-GLP',
            name: 'Isolation Mode:',
            decimals: 18,
            tokenAddress: factory.address,
        };
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await core.liquidatorAssetRegistry.connect(core.governance)
            .ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.liquidatorProxyV4.address);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
        liquidAccountStruct = { owner: vault.address, number: borrowAccountNumber };
        solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.usdc);
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.weth);
        router = sdk_v2_1.Router.getRouter({
            chainId: ChainId_1.CHAIN_ID_MAPPING.ARBITRUM,
            provider: core.hhUser1.provider,
            signer: core.hhUser1,
        });
        const usdcAmount = heldAmountWei.div(1e12).mul(8);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        const glpAmount = heldAmountWei.mul(4);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.pendleEcosystem.pendleRouter.address, glpAmount);
        await router.swapExactTokenForPt(core.pendleEcosystem.ptGlpMarket.address, core.gmxEcosystem.sGlp.address, glpAmount, defaultSlippage);
        await core.pendleEcosystem.ptGlpToken.connect(core.hhUser1).approve(vault.address, heldAmountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, underlyingMarketId)).value)
            .to
            .eq(heldAmountWei);
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
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
            await core.testPriceOracle.setPrice(core.tokens.usdc.address, '1050000000000000000000000000000');
            await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testPriceOracle.address);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const owedMarketPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
            const ptGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
            const owedAmount = await core.dolomiteMargin.getAccountWei(liquidAccountStruct, core.marketIds.usdc);
            const heldUpdatedWithReward = await owedAmount.value
                .mul(owedMarketPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator))
                .div(ptGlpPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(ptGlpApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.usdc, (0, liquidation_utils_1.toZapBigNumber)(owedAmount.value), core.hhUser5.address);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcDebtAmount.mul(5).div(100), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectVaultBalanceToMatchAccountBalances)(core, vault, [liquidAccountStruct, defaultAccountStruct], underlyingMarketId);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.pendleEcosystem.ptGlpToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.gmxEcosystem.fsGlp, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
        });
        it('should work when liquid account is borrowing a different output token (WETH)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
                .div(minCollateralizationNumerator)
                .div(wethPrice.value);
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
            // set the price of USDC to be 105% of the current price
            await core.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice.value.mul('105').div('100'));
            await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testPriceOracle.address);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const glpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(glpPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(ptGlpApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.weth, (0, liquidation_utils_1.toZapBigNumber)(wethDebtAmount), core.hhUser5.address);
            const isSuccessful = await (0, liquidation_utils_1.checkForParaswapSuccess)((0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs));
            if (!isSuccessful) {
                return;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceDustyOrZero)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, newAccountValues[1].value.mul(106).div(100).mul(defaultSlippageNumerator).div(defaultSlippageDenominator));
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, (0, liquidation_utils_1.getLastZapAmountToBigNumber)(zapOutputs[0]).sub(wethDebtAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectVaultBalanceToMatchAccountBalances)(core, vault, [liquidAccountStruct, defaultAccountStruct], underlyingMarketId);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.pendleEcosystem.ptGlpToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.gmxEcosystem.fsGlp, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.weth, no_deps_constants_1.ZERO_BI);
        });
    });
    describe('Perform expiration with full integration', () => {
        it('should work when expired account is borrowing the output token (USDC)', async () => {
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
            const usdcDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(usdcPrice.value);
            await vault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
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
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(underlyingMarketId, core.marketIds.usdc, expiry);
            const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(ptGlpApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.usdc, (0, liquidation_utils_1.toZapBigNumber)(usdcDebtAmount), core.hhUser5.address);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs, expiry);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            const amountWeisPath = zapOutputs[0].amountWeisPath;
            const usdcAmountOut = ethers_1.BigNumber.from(amountWeisPath[amountWeisPath.length - 1].toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcAmountOut.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectVaultBalanceToMatchAccountBalances)(core, vault, [liquidAccountStruct, defaultAccountStruct], underlyingMarketId);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.pendleEcosystem.ptGlpToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.gmxEcosystem.fsGlp, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.weth, no_deps_constants_1.ZERO_BI);
        });
        it('should work when expired account is borrowing a different output token (WETH)', async () => {
            const ptGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = heldAmountWei.mul(ptGlpPrice.value)
                .mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(wethPrice.value);
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(borrowAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed over collateralized
            (0, chai_1.expect)(supplyValue.value)
                .to
                .gte(borrowValue.value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const rampTime = await core.expiry.g_expiryRampTime();
            await (0, expiry_utils_1.setExpiry)(core, liquidAccountStruct, core.marketIds.weth, 1);
            await (0, utils_1.waitTime)(rampTime.add(no_deps_constants_1.ONE_BI).toNumber());
            const expiry = await core.expiry.getExpiry(liquidAccountStruct, core.marketIds.weth);
            (0, chai_1.expect)(expiry).to.not.eq(0);
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(underlyingMarketId, core.marketIds.weth, expiry);
            const owedAmount = (await core.dolomiteMargin.getAccountWei(liquidAccountStruct, core.marketIds.weth)).value;
            const heldUpdatedWithReward = owedAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(ptGlpApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.weth, (0, liquidation_utils_1.toZapBigNumber)(wethDebtAmount), core.hhUser5.address);
            const amountWeisPath = zapOutputs[0].amountWeisPath;
            const wethOutputAmount = ethers_1.BigNumber.from(amountWeisPath[amountWeisPath.length - 1].toString());
            const isSuccessful = await (0, liquidation_utils_1.checkForParaswapSuccess)((0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs, expiry));
            if (!isSuccessful) {
                return;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceDustyOrZero)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, borrowValue.value.mul(106).div(100).mul(defaultSlippageNumerator).div(defaultSlippageDenominator));
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, wethOutputAmount.sub(owedAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectVaultBalanceToMatchAccountBalances)(core, vault, [liquidAccountStruct, defaultAccountStruct], underlyingMarketId);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, factory, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(core.liquidatorProxyV4.address, core.tokens.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.pendleEcosystem.ptGlpToken, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.gmxEcosystem.fsGlp, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(unwrapper, core.tokens.weth, no_deps_constants_1.ZERO_BI);
        });
    });
});

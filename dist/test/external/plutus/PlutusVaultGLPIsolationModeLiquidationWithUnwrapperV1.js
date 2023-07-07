"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const expiry_utils_1 = require("../../utils/expiry-utils");
const liquidation_utils_1 = require("../../utils/liquidation-utils");
const setup_1 = require("../../utils/setup");
const plutus_utils_1 = require("./plutus-utils");
const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const minCollateralizationNumerator = ethers_1.BigNumber.from('115');
const minCollateralizationDenominator = ethers_1.BigNumber.from('100');
const liquidationSpreadNumerator = ethers_1.BigNumber.from('105');
const liquidationSpreadDenominator = ethers_1.BigNumber.from('100');
const expirationCollateralizationNumerator = ethers_1.BigNumber.from('150');
const expirationCollateralizationDenominator = ethers_1.BigNumber.from('100');
describe('PlutusVaultGLPLiquidationWithUnwrapperV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let plutusVaultRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
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
        underlyingToken = core.plutusEcosystem.plvGlp.connect(core.hhUser1);
        const userVaultImplementation = await (0, plutus_1.createPlutusVaultGLPIsolationModeTokenVaultV1)();
        plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, core.plutusEcosystem.plvGlp, userVaultImplementation);
        unwrapper = await (0, plutus_1.createPlutusVaultGLPIsolationModeUnwrapperTraderV1)(core, plutusVaultRegistry, factory);
        wrapper = await (0, plutus_1.createPlutusVaultGLPIsolationModeWrapperTraderV1)(core, plutusVaultRegistry, factory);
        priceOracle = await (0, plutus_1.createPlutusVaultGLPPriceOracle)(core, plutusVaultRegistry, factory, unwrapper);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PlutusVaultGLPIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
        liquidAccountStruct = { owner: vault.address, number: otherAccountNumber };
        solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };
        const usdcAmount = heldAmountWei.div(1e12).mul(4);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        const glpAmount = heldAmountWei.mul(2);
        await core.plutusEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.plutusEcosystem.plvGlpRouter.address, glpAmount);
        await core.plutusEcosystem.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
        await underlyingToken.approve(vault.address, heldAmountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, underlyingMarketId)).value)
            .to
            .eq(heldAmountWei);
        await core.liquidatorProxyV3.connect(core.governance).setMarketIdToTokenUnwrapperForLiquidationMap(underlyingMarketId, unwrapper.address);
        await (0, plutus_utils_1.createAndSetPlutusVaultWhitelist)(core, core.plutusEcosystem.plvGlpRouter, unwrapper, wrapper, factory);
        await (0, plutus_utils_1.createAndSetPlutusVaultWhitelist)(core, core.plutusEcosystem.plvGlpFarm, unwrapper, wrapper, factory);
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
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(otherAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
            await core.testPriceOracle.setPrice(core.tokens.usdc.address, '1050000000000000000000000000000');
            await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testPriceOracle.address);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const plvGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(plvGlpPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const txResult = await core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.usdc, underlyingMarketId, no_deps_constants_1.NO_EXPIRY, no_deps_constants_1.BYTES_EMPTY);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, factory.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.plutusEcosystem.plvGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
        it('should work when liquid account is borrowing a different output token (WETH)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
                .div(minCollateralizationNumerator)
                .div(wethPrice.value);
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(otherAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
            // set the price of USDC to be 105% of the current price
            await core.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator));
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
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(usdcOutputAmount, core.tokens.usdc, 6, no_deps_constants_1.ONE_BI, core.tokens.weth, 18, core.hhUser5, core.liquidatorProxyV3, core);
            const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const isSuccessful = await (0, liquidation_utils_1.checkForParaswapSuccess)(core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.weth, underlyingMarketId, no_deps_constants_1.NO_EXPIRY, paraswapCalldata));
            if (!isSuccessful) {
                return;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, wethOutputAmount.sub(wethDebtAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, usdcLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI, wethLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.plutusEcosystem.plvGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
    describe('Perform expiration with full integration', () => {
        it('should work when expired account is borrowing the output token (USDC)', async () => {
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
            const usdcDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(usdcPrice.value);
            await vault.transferFromPositionWithOtherToken(otherAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmount, src_1.BalanceCheckFlag.To);
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
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const txResult = await core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.usdc, underlyingMarketId, expiry, no_deps_constants_1.BYTES_EMPTY);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, factory.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.plutusEcosystem.plvGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
        it('should work when expired account is borrowing a different output token (WETH)', async () => {
            const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
            (0, chai_1.expect)(borrowValue.value).to.eq(no_deps_constants_1.ZERO_BI);
            const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
            const wethDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
                .div(expirationCollateralizationNumerator)
                .div(wethPrice.value);
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(otherAccountNumber, defaultAccountNumber, core.marketIds.weth, wethDebtAmount, src_1.BalanceCheckFlag.To);
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
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(underlyingMarketId, core.marketIds.weth, expiry);
            const heldUpdatedWithReward = wethDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY);
            const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(usdcOutputAmount, core.tokens.usdc, 6, wethDebtAmount, core.tokens.weth, 18, core.hhUser5, core.liquidatorProxyV3, core);
            const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
                .balanceOf(core.liquidatorProxyV3.address);
            const isSuccessful = await (0, liquidation_utils_1.checkForParaswapSuccess)(core.liquidatorProxyV3.connect(core.hhUser5).liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.weth, underlyingMarketId, expiry, paraswapCalldata));
            if (!isSuccessful) {
                return false;
            }
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.weth, wethOutputAmount.sub(wethDebtAmount), '500');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '10');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, usdcLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV3.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI, wethLiquidatorBalanceBefore);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.plutusEcosystem.plvGlp.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
});

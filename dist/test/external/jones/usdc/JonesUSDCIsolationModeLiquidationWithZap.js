"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dist_1 = require("@dolomite-exchange/zap-sdk/dist");
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const deployments_json_1 = __importDefault(require("../../../../scripts/deployments.json"));
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const expiry_utils_1 = require("../../../utils/expiry-utils");
const liquidation_utils_1 = require("../../../utils/liquidation-utils");
const setup_1 = require("../../../utils/setup");
const jones_utils_1 = require("./jones-utils");
const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const usdcAmount = heldAmountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const minCollateralizationNumerator = ethers_1.BigNumber.from('115');
const minCollateralizationDenominator = ethers_1.BigNumber.from('100');
const liquidationSpreadNumerator = ethers_1.BigNumber.from('105');
const liquidationSpreadDenominator = ethers_1.BigNumber.from('100');
const expirationCollateralizationNumerator = ethers_1.BigNumber.from('150');
const expirationCollateralizationDenominator = ethers_1.BigNumber.from('100');
describe('JonesUSDCIsolationModeLiquidationWithZap', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let heldMarketId;
    let jonesUSDCRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let priceOracle;
    let defaultAccountStruct;
    let liquidAccountStruct;
    let solidAccountStruct;
    let jUsdcApiToken;
    let zap;
    before(async () => {
        const network = no_deps_constants_1.Network.ArbitrumOne;
        const blockNumber = await (0, utils_1.getRealLatestBlockNumber)(true, network);
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber,
            network,
        });
        underlyingToken = core.jonesEcosystem.jUSDC.connect(core.hhUser1);
        jonesUSDCRegistry = await types_1.JonesUSDCRegistry__factory.connect(deployments_json_1.default.JonesUSDCRegistry[network].address, core.hhUser1);
        factory = types_1.JonesUSDCIsolationModeVaultFactory__factory.connect(deployments_json_1.default.JonesUSDCIsolationModeVaultFactory[network].address, core.hhUser1);
        unwrapper = types_1.JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(deployments_json_1.default.JonesUSDCIsolationModeUnwrapperTraderV2[network].address, core.hhUser1);
        wrapper = types_1.JonesUSDCIsolationModeWrapperTraderV2__factory.connect(deployments_json_1.default.JonesUSDCIsolationModeWrapperTraderV2[network].address, core.hhUser1);
        await (0, jones_utils_1.createRoleAndWhitelistTrader)(core, unwrapper, wrapper);
        priceOracle = types_1.JonesUSDCPriceOracle__factory.connect(deployments_json_1.default.JonesUSDCPriceOracle[network].address, core.hhUser1);
        heldMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);
        jUsdcApiToken = {
            marketId: heldMarketId.toNumber(),
            symbol: 'jUSDC',
            name: 'Dolomite Isolation: Jones USDC',
            decimals: 18,
            tokenAddress: factory.address,
        };
        zap = new dist_1.DolomiteZap(dist_1.Network.ARBITRUM_ONE, process.env.SUBGRAPH_URL, core.hhUser1.provider);
        // admin setup
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(heldMarketId, core.liquidatorProxyV4.address);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.JonesUSDCIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
        liquidAccountStruct = { owner: vault.address, number: otherAccountNumber };
        solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.jonesEcosystem.glpAdapter);
        await core.jonesEcosystem.glpAdapter.connect(core.hhUser1).depositStable(usableUsdcAmount, true);
        await core.jonesEcosystem.jUSDC.connect(core.hhUser1).approve(vault.address, heldAmountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, heldMarketId)).value)
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
            const usdcDebtAmountBefore = supplyValue.value
                .mul(minCollateralizationDenominator)
                .div(minCollateralizationNumerator)
                .div(usdcPrice.value);
            await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
            await vault.transferFromPositionWithOtherToken(otherAccountNumber, defaultAccountNumber, core.marketIds.usdc, usdcDebtAmountBefore, src_1.BalanceCheckFlag.To);
            await core.testInterestSetter.setInterestRate(core.tokens.usdc.address, { value: '33295281582' }); // 100% APR
            await core.dolomiteMargin.ownerSetInterestSetter(core.marketIds.usdc, core.testInterestSetter.address);
            await (0, utils_1.waitDays)(10); // accrue interest to push towards liquidation
            // deposit 0 to refresh account index
            await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
            // check that the position is indeed under collateralized
            (0, chai_1.expect)(newAccountValues[0].value)
                .to
                .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));
            const jUSDCPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(jUSDCPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(jUsdcApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.usdc, (0, liquidation_utils_1.toZapBigNumber)(usdcDebtAmountBefore), core.hhUser5.address);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            const heldUsdcAfter = (await core.dolomiteMargin.getAccountWei(solidAccountStruct, core.marketIds.usdc)).value;
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY, { blockTag: txResult.blockNumber });
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, heldUsdcAfter.sub(usdcOutputAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, factory.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.jonesEcosystem.jUSDC.address, no_deps_constants_1.ZERO_BI);
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
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(heldMarketId, core.marketIds.usdc, expiry);
            const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const zapOutputs = await zap.getSwapExactTokensForTokensParams(jUsdcApiToken, (0, liquidation_utils_1.toZapBigNumber)(heldUpdatedWithReward), core.apiTokens.usdc, (0, liquidation_utils_1.toZapBigNumber)(usdcDebtAmount), core.hhUser5.address);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithZap)(core, solidAccountStruct, liquidAccountStruct, zapOutputs, expiry);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY, { blockTag: txResult.blockNumber });
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, heldMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, heldMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, factory.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.jonesEcosystem.jUSDC.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
});

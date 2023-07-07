"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../../src/types");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
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
describe('JonesUSDCLiquidationWithUnwrapperV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let jonesUSDCRegistry;
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
        underlyingToken = core.jonesEcosystem.jUSDC.connect(core.hhUser1);
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapper.address);
        wrapper = await (0, jones_1.createJonesUSDCIsolationModeWrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await (0, jones_utils_1.createRoleAndWhitelistTrader)(core, unwrapper, wrapper);
        priceOracle = await (0, jones_1.createJonesUSDCPriceOracle)(core, jonesUSDCRegistry, factory);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        // admin setup
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.liquidatorProxyV4.address);
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
            const jUSDCPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
            const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
                .div(liquidationSpreadDenominator)
                .div(jUSDCPrice.value);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithIsolationMode)(core, solidAccountStruct, liquidAccountStruct, [underlyingMarketId, core.marketIds.usdc], [no_deps_constants_1.SELL_ALL, no_deps_constants_1.LIQUIDATE_ALL], unwrapper);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            const heldUsdcAfter = (await core.dolomiteMargin.getAccountWei(solidAccountStruct, core.marketIds.usdc)).value;
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY, { blockTag: txResult.blockNumber });
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, heldUsdcAfter.sub(usdcOutputAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
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
            const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(underlyingMarketId, core.marketIds.usdc, expiry);
            const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
            const txResult = await (0, liquidation_utils_1.liquidateV4WithIsolationMode)(core, solidAccountStruct, liquidAccountStruct, [underlyingMarketId, core.marketIds.usdc], [no_deps_constants_1.SELL_ALL, no_deps_constants_1.LIQUIDATE_ALL], unwrapper, no_deps_constants_1.BYTES_EMPTY, no_deps_constants_1.NO_PARASWAP_TRADER_PARAM, expiry);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            const usdcOutputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, heldUpdatedWithReward, no_deps_constants_1.BYTES_EMPTY, { blockTag: txResult.blockNumber });
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, underlyingMarketId, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, usdcOutputAmount.sub(usdcDebtAmount), '5');
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, underlyingMarketId, heldAmountWei.sub(heldUpdatedWithReward), '5');
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, factory.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, core.liquidatorProxyV4.address, core.tokens.weth.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.jonesEcosystem.jUSDC.address, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, unwrapper.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI);
        });
    });
});

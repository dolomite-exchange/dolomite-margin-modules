"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../../src/types");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
const setup_1 = require("../../../utils/setup");
const jones_utils_1 = require("./jones-utils");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('JonesUSDCIsolationModeUnwrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let gmxRegistry;
    let jonesUSDCRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let priceOracle;
    let defaultAccount;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 100000001,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        underlyingToken = core.jonesEcosystem.jUSDC;
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        gmxRegistry = core.gmxEcosystem.live.gmxRegistry;
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapper.address);
        wrapper = await (0, jones_1.createJonesUSDCIsolationModeWrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await (0, jones_utils_1.createRoleAndWhitelistTrader)(core, unwrapper, wrapper);
        priceOracle = await (0, jones_1.createJonesUSDCPriceOracle)(core, jonesUSDCRegistry, factory);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.liquidatorProxyV4.address);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.JonesUSDCIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.jonesEcosystem.glpAdapter);
        await core.jonesEcosystem.glpAdapter.connect(core.hhUser1).depositStable(usableUsdcAmount, true);
        await core.jonesEcosystem.jUSDC.connect(core.hhUser1).approve(vault.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Actions.Call and Actions.Sell for non-liquidation', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await unwrapper.createActionsForUnwrapping(solidAccountId, liquidAccountId, vault.address, vault.address, core.marketIds.usdc, underlyingMarketId, no_deps_constants_1.ZERO_BI, amountWei, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.hhUser5.address);
            const result = await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            // jUSDC's value goes up every second. To get the correct amountOut, we need to use the same block #
            const amountOut = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY, { blockTag: result.blockNumber });
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(amountOut);
        });
    });
    describe('#callFunction', () => {
        it('should fail if sender function param is not a valid liquidator', async () => {
            const impersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser1.address, true);
            const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(underlyingMarketId);
            (0, chai_1.expect)(liquidators.length).to.eq(1);
            (0, chai_1.expect)(liquidators[0]).to.eq(core.liquidatorProxyV4.address);
            (0, chai_1.expect)(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(underlyingMarketId, core.hhUser1.address)).to.eq(false);
            await (0, assertions_1.expectThrow)(unwrapper.connect(impersonator).callFunction(core.hhUser1.address, { owner: solidUser.address, number: no_deps_constants_1.ZERO_BI }, no_deps_constants_1.BYTES_EMPTY), `JonesUSDCUnwrapperV2: Sender must be a liquidator <${core.hhUser1.address.toLowerCase()}>`);
            await core.liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(underlyingMarketId, core.liquidatorProxyV4.address);
            (0, chai_1.expect)((await core.liquidatorAssetRegistry.getLiquidatorsForAsset(underlyingMarketId)).length).to.eq(0);
            (0, chai_1.expect)(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(underlyingMarketId, core.hhUser1.address)).to.eq(true); // returns true because the length is 0
            await (0, assertions_1.expectThrow)(unwrapper.connect(impersonator).callFunction(core.hhUser1.address, { owner: solidUser.address, number: no_deps_constants_1.ZERO_BI }, no_deps_constants_1.BYTES_EMPTY), `JonesUSDCUnwrapperV2: Sender must be a liquidator <${core.hhUser1.address.toLowerCase()}>`);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, core.tokens.weth.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.jonesEcosystem.jUSDC.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.dfsGlp.address, factory.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if input amount is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.jonesEcosystem.jUSDC.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.usdc.address, factory.address, no_deps_constants_1.ZERO_BI, abiCoder.encode(['uint256'], [otherAmountWei])), 'IsolationModeUnwrapperTraderV2: Invalid input amount');
        });
    });
    describe('#token', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.token()).to.eq(factory.address);
        });
    });
    describe('#actionsLength', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.actionsLength()).to.eq(2);
        });
    });
    describe('#jonesUSDCRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.JONES_USDC_REGISTRY()).to.eq(jonesUSDCRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const receiptToken = core.jonesEcosystem.usdcReceiptToken.connect(core.hhUser1);
            const receiptTokenExchangeRateNumerator = await receiptToken.totalAssets();
            const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
            const receiptTokenExchangeRateDenominator = await await receiptToken.totalSupply();
            const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();
            const amountBeforeRetention = amountWei
                .mul(jUSDCExchangeRateNumerator)
                .div(jUSDCExchangeRateDenominator)
                .mul(receiptTokenExchangeRateNumerator)
                .div(receiptTokenExchangeRateDenominator);
            const retentionFee = amountBeforeRetention.mul('97').div('10000');
            const expectedAmount = amountBeforeRetention.sub(retentionFee);
            (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY))
                .to
                .eq(expectedAmount);
        });
        it('should work for 10 random numbers, as long as balance is sufficient', async () => {
            const receiptToken = core.jonesEcosystem.usdcReceiptToken.connect(core.hhUser1);
            const receiptTokenExchangeRateNumerator = await receiptToken.totalAssets();
            const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
            const receiptTokenExchangeRateDenominator = await await receiptToken.totalSupply();
            const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();
            for (let i = 0; i < 10; i++) {
                // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
                const randomNumber = ethers_1.BigNumber.from(Math.floor(Math.random() * 99) + 1);
                const weirdAmount = amountWei.mul(randomNumber).div(101);
                const amountBeforeRetention = weirdAmount
                    .mul(jUSDCExchangeRateNumerator)
                    .div(jUSDCExchangeRateDenominator)
                    .mul(receiptTokenExchangeRateNumerator)
                    .div(receiptTokenExchangeRateDenominator);
                const expectedAmount = amountBeforeRetention.sub(amountBeforeRetention.mul('97').div('10000'));
                (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedAmount);
            }
        });
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const umami_1 = require("../../utils/ecosystem-token-utils/umami");
const setup_1 = require("../../utils/setup");
const umami_utils_1 = require("./umami-utils");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const withdrawalFeeNumerator = ethers_1.BigNumber.from('750000000000000000');
const withdrawalFeeDenominator = ethers_1.BigNumber.from('100000000000000000000');
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('UmamiAssetVaultIsolationModeUnwrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let gmxRegistry;
    let umamiRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let priceOracle;
    let defaultAccount;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = core.umamiEcosystem.glpUsdc;
        const userVaultImplementation = await (0, umami_1.createUmamiAssetVaultIsolationModeTokenVaultV1)();
        gmxRegistry = core.gmxEcosystem.live.gmxRegistry;
        umamiRegistry = await (0, umami_1.createUmamiAssetVaultRegistry)(core);
        factory = await (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, umamiRegistry, underlyingToken, core.tokens.usdc, userVaultImplementation);
        unwrapper = await (0, umami_1.createUmamiAssetVaultIsolationModeUnwrapperTraderV2)(core, umamiRegistry, factory);
        wrapper = await (0, umami_1.createUmamiAssetVaultIsolationModeWrapperTraderV2)(core, umamiRegistry, factory);
        priceOracle = await (0, umami_1.createUmamiAssetVaultPriceOracle)(core, umamiRegistry, factory);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.usdc);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.UmamiAssetVaultIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        await (0, umami_utils_1.setupWhitelistAndAggregateVault)(core, umamiRegistry);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.umamiEcosystem.glpUsdc);
        await core.umamiEcosystem.glpUsdc.connect(core.hhUser1).deposit(usableUsdcAmount, core.hhUser1.address);
        await core.umamiEcosystem.glpUsdc.connect(core.hhUser1).approve(vault.address, amountWei);
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
            const amountOut = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(amountOut);
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
            await core.umamiEcosystem.glpUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.dfsGlp.address, factory.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if input amount is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.umamiEcosystem.glpUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
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
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const exchangeRateNumerator = await underlyingToken.totalAssets();
            const exchangeRateDenominator = await underlyingToken.totalSupply();
            const amountBeforeWithdrawalFee = amountWei
                .mul(exchangeRateNumerator)
                .div(exchangeRateDenominator);
            const withdrawalFee = amountBeforeWithdrawalFee.mul(withdrawalFeeNumerator).div(withdrawalFeeDenominator);
            (0, chai_1.expect)(await core.umamiEcosystem.glpUsdc.previewWithdrawalFee(amountBeforeWithdrawalFee)).to.eq(withdrawalFee);
            const expectedAmount = amountBeforeWithdrawalFee.sub(withdrawalFee);
            (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY)).to.eq(expectedAmount);
        });
        it('should work for 10 random numbers, as long as balance is sufficient', async () => {
            const exchangeRateNumerator = await underlyingToken.totalAssets();
            const exchangeRateDenominator = await underlyingToken.totalSupply();
            for (let i = 0; i < 10; i++) {
                // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
                const randomNumber = ethers_1.BigNumber.from(Math.floor(Math.random() * 99) + 1);
                const weirdAmount = amountWei.mul(randomNumber).div(101);
                const amountBeforeWithdrawalFee = weirdAmount
                    .mul(exchangeRateNumerator)
                    .div(exchangeRateDenominator);
                const expectedAmount = amountBeforeWithdrawalFee
                    .sub(amountBeforeWithdrawalFee.mul(withdrawalFeeNumerator).div(withdrawalFeeDenominator));
                (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedAmount);
            }
        });
    });
});

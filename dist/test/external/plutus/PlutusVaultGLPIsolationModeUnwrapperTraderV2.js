"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const plutus_1 = require("../../utils/ecosystem-token-utils/plutus");
const setup_1 = require("../../utils/setup");
const plutus_utils_1 = require("./plutus-utils");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('PlutusVaultGLPIsolationModeUnwrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let gmxRegistry;
    let plutusVaultRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let priceOracle;
    let defaultAccount;
    let plvGlpExchangeRateNumerator;
    let plvGlpExchangeRateDenominator;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        underlyingToken = core.plutusEcosystem.plvGlp;
        const userVaultImplementation = await (0, plutus_1.createPlutusVaultGLPIsolationModeTokenVaultV1)();
        gmxRegistry = core.gmxEcosystem.live.gmxRegistry;
        plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, plutus_1.createPlutusVaultGLPIsolationModeUnwrapperTraderV2)(core, plutusVaultRegistry, factory);
        wrapper = await (0, plutus_1.createPlutusVaultGLPIsolationModeWrapperTraderV2)(core, plutusVaultRegistry, factory);
        priceOracle = await (0, plutus_1.createPlutusVaultGLPPriceOracle)(core, plutusVaultRegistry, factory, unwrapper);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        await (0, plutus_utils_1.createAndSetPlutusVaultWhitelist)(core, core.plutusEcosystem.plvGlpFarm, unwrapper, wrapper, factory);
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PlutusVaultGLPIsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        const usdcAmount = amountWei.div(1e12).mul(8);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        const glpAmount = amountWei.mul(4);
        await core.plutusEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.plutusEcosystem.plvGlpRouter.address, glpAmount);
        await core.plutusEcosystem.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
        await core.plutusEcosystem.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);
        // account for the fee in the numerator
        plvGlpExchangeRateNumerator = (await underlyingToken.totalAssets()).mul(98).div(100);
        plvGlpExchangeRateDenominator = await underlyingToken.totalSupply();
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
            await core.plutusEcosystem.plvGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.dfsGlp.address, factory.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if input amount is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.plutusEcosystem.plvGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
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
    describe('#gmxRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
        });
    });
    describe('#plutusVaultRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.PLUTUS_VAULT_REGISTRY()).to.eq(plutusVaultRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should be greater than oracle price for $10M redemption', async () => {
            const ONE_WEI = ethers_1.BigNumber.from('1000000000000000000');
            const TEN_MILLION = ethers_1.BigNumber.from('10000000');
            const amount = ONE_WEI.mul(TEN_MILLION);
            const decimalDelta = ethers_1.BigNumber.from('1000000000000');
            const outputAmount = await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amount, no_deps_constants_1.BYTES_EMPTY);
            const oraclePrice = (await priceOracle.getPrice(factory.address)).value.div(decimalDelta);
            console.log('\toutputAmount', outputAmount.toString());
            console.log('\toraclePrice', oraclePrice.toString());
            // the effective price should be greater than the oracle price and less than the oracle price + 0.75%
            (0, chai_1.expect)(outputAmount.div(TEN_MILLION)).to.be.gt(oraclePrice);
            (0, chai_1.expect)(outputAmount.div(TEN_MILLION)).to.be.lt(oraclePrice.mul('10075').div('10000'));
        });
        it('should work normally', async () => {
            const glpAmount = amountWei.mul(plvGlpExchangeRateNumerator).div(plvGlpExchangeRateDenominator);
            const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                .callStatic
                .unstakeAndRedeemGlp(core.tokens.usdc.address, glpAmount, 1, core.hhUser1.address);
            (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY))
                .to
                .eq(expectedAmount);
        });
        it('should work for 10 random numbers, as long as balance is sufficient', async () => {
            for (let i = 0; i < 10; i++) {
                // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
                const randomNumber = ethers_1.BigNumber.from(Math.floor(Math.random() * 99) + 1);
                const weirdAmount = amountWei.mul(randomNumber).div(101);
                const glpAmount = weirdAmount.mul(plvGlpExchangeRateNumerator).div(plvGlpExchangeRateDenominator);
                const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
                    .callStatic
                    .unstakeAndRedeemGlp(core.tokens.usdc.address, glpAmount, 1, core.hhUser1.address);
                (0, chai_1.expect)(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedAmount);
            }
        });
    });
});

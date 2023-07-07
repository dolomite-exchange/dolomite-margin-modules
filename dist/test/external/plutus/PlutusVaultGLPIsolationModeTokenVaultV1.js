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
const amountWei = ethers_1.BigNumber.from('1250000000000000000000'); // 1,250 plvGLP tokens
const stakedAmountWei = amountWei.mul(2).div(3); // 833.3333 plvGLP tokens
const unstakedAmountWei = amountWei.sub(stakedAmountWei); // 416.6666 plvGLP tokens
const accountNumber = no_deps_constants_1.ZERO_BI;
describe('PlutusVaultGLPIsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let plutusVaultRegistry;
    let unwrapper;
    let wrapper;
    let priceOracle;
    let factory;
    let vault;
    let underlyingMarketId;
    let account;
    let rewardToken;
    let farm;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        underlyingToken = core.plutusEcosystem.plvGlp.connect(core.hhUser1);
        rewardToken = core.plutusEcosystem.plsToken.connect(core.hhUser1);
        farm = core.plutusEcosystem.plvGlpFarm.connect(core.hhUser1);
        const userVaultImplementation = await (0, plutus_1.createPlutusVaultGLPIsolationModeTokenVaultV1)();
        plutusVaultRegistry = await (0, plutus_1.createPlutusVaultRegistry)(core);
        factory = await (0, plutus_1.createPlutusVaultGLPIsolationModeVaultFactory)(core, plutusVaultRegistry, underlyingToken, userVaultImplementation);
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
        account = { owner: vault.address, number: accountNumber };
        const usdcAmount = amountWei.div(1e12).mul(8);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        const glpAmount = amountWei.mul(4);
        await core.plutusEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.plutusEcosystem.plvGlpRouter.address, glpAmount);
        await core.plutusEcosystem.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
        await core.plutusEcosystem.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
        await (0, plutus_utils_1.createAndSetPlutusVaultWhitelist)(core, core.plutusEcosystem.plvGlpFarm, unwrapper, wrapper, factory);
        await (0, plutus_utils_1.createAndSetPlutusVaultWhitelist)(core, core.plutusEcosystem.plvGlpRouter, unwrapper, wrapper, factory);
        const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
        (0, chai_1.expect)(glpProtocolBalance.sign).to.eq(true);
        (0, chai_1.expect)(glpProtocolBalance.value).to.eq(amountWei);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#stakePlvGlp', () => {
        it('should work normally', async () => {
            await vault.stakePlvGlp(stakedAmountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).stakePlvGlp(stakedAmountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#harvest', () => {
        it('should work normally', async () => {
            await vault.stakePlvGlp(stakedAmountWei);
            await (0, utils_1.waitDays)(10);
            (0, chai_1.expect)(await rewardToken.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await rewardToken.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            await vault.harvest();
            (0, chai_1.expect)(await rewardToken.balanceOf(core.hhUser1.address)).to.not.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await rewardToken.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).harvest(), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#unstakePlvGlp', () => {
        it('should work normally', async () => {
            await vault.stakePlvGlp(stakedAmountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
            await vault.unstakePlvGlp(unstakedAmountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei.mul(2));
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei.sub(unstakedAmountWei));
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).unstakePlvGlp(stakedAmountWei), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#executeWithdrawalFromVault', () => {
        it('should work normally', async () => {
            const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
            await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
        });
        it('should work when plvGLP needs to be un-staked', async () => {
            const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
            await vault.stakePlvGlp(stakedAmountWei);
            // balance should not have changed
            (0, chai_1.expect)(await underlyingToken.balanceOf(core.hhUser1.address)).to.eq(balanceBefore);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
            (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(amountWei);
            await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(no_deps_constants_1.ZERO_BI);
        });
        it('should work when plvGLP needs to be un-staked and rewards are paused', async () => {
            const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
            await vault.stakePlvGlp(stakedAmountWei);
            // balance should not have changed
            (0, chai_1.expect)(await underlyingToken.balanceOf(core.hhUser1.address)).to.eq(balanceBefore);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
            (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(amountWei);
            const farmOwner = await (0, utils_1.impersonate)(await farm.owner(), true);
            await farm.connect(farmOwner).setPaused(true);
            (0, chai_1.expect)(await farm.paused()).to.be.true;
            await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
            (0, chai_1.expect)(await underlyingToken.balanceOf(vault.address)).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await farm.userInfo(vault.address))._balance).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by vault factory', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser2.address, amountWei), `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#plvGlpFarm', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.plvGlpFarm()).to.equal(core.plutusEcosystem.plvGlpFarm.address);
        });
    });
    describe('#pls', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.pls()).to.equal(core.plutusEcosystem.plsToken.address);
        });
    });
    describe('#underlyingBalanceOf', () => {
        it('should work when funds are only in vault', async () => {
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(amountWei);
        });
        it('should work when funds are in vault and staked', async () => {
            await vault.stakePlvGlp(stakedAmountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(amountWei); // amount should be unchanged
        });
    });
    describe('#isExternalRedemptionPaused', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
        });
        it('should work vault params are set to false', async () => {
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.false;
            const plvGlp = types_1.IPlutusVaultGLP__factory.connect(await plutusVaultRegistry.plvGlpToken(), core.hhUser1);
            const owner = await (0, utils_1.impersonate)(await plvGlp.owner(), true);
            const canDoAnything = false;
            await plvGlp.connect(owner).setParams(canDoAnything, canDoAnything, canDoAnything, canDoAnything);
            (0, chai_1.expect)(await vault.isExternalRedemptionPaused()).to.be.true;
        });
    });
});

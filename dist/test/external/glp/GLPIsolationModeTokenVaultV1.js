"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const gmx_1 = require("../../utils/ecosystem-token-utils/gmx");
const setup_1 = require("../../utils/setup");
const gmxAmount = ethers_1.BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = ethers_1.BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = ethers_1.BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const esGmxAmount = ethers_1.BigNumber.from('10000000000000000'); // 0.01 esGMX tokens
const accountNumber = no_deps_constants_1.ZERO_BI;
describe('GLPIsolationModeTokenVaultV1', () => {
    let snapshotId;
    let core;
    let factory;
    let vault;
    let underlyingMarketId;
    let glpAmount;
    let account;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        const vaultImplementation = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestGLPIsolationModeTokenVaultV1__factory.abi, types_1.TestGLPIsolationModeTokenVaultV1__factory.bytecode, []);
        const gmxRegistry = await (0, gmx_1.createGmxRegistry)(core);
        factory = await (0, gmx_1.createGLPIsolationModeVaultFactory)(core, gmxRegistry, vaultImplementation);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
        await (0, setup_1.setupTestMarket)(core, factory, true);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        await factory.connect(core.governance).ownerInitialize([]);
        await factory.createVault(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(await factory.getVaultByAccount(core.hhUser1.address), types_1.TestGLPIsolationModeTokenVaultV1__factory, core.hhUser1);
        account = { owner: vault.address, number: accountNumber };
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, no_deps_constants_1.ONE_BI, no_deps_constants_1.ONE_BI);
        // use sGLP for approvals/transfers and fsGLP for checking balances
        glpAmount = await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(vault.address, no_deps_constants_1.MAX_UINT_256_BI);
        await vault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
        (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
        const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
        (0, chai_1.expect)(glpProtocolBalance.sign).to.eq(true);
        (0, chai_1.expect)(glpProtocolBalance.value).to.eq(amountWei);
        await core.gmxEcosystem.esGmxDistributor.setTokensPerInterval('10333994708994708');
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    async function doHandleRewardsWithWaitTime(daysToWait) {
        if (daysToWait > 0) {
            await (0, utils_1.waitDays)(daysToWait);
        }
        await vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, true, true, false, accountNumber);
    }
    describe('#handleRewards', () => {
        async function setupGmxStakingAndEsGmxVesting() {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).gte(gmxAmount)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.eq(no_deps_constants_1.ZERO_BI);
        }
        it('should work when assets are claimed and not staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewards(true, false, true, false, true, true, false);
            (0, chai_1.expect)((await core.gmxEcosystem.esGmx.balanceOf(vault.address)).gt(esGmxAmount)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            await vault.vestGlp(esGmxAmount);
            await vault.vestGmx(esGmxAmount);
            await (0, utils_1.waitDays)(366);
            await vault.handleRewards(true, false, true, false, true, true, false);
            // GMX rewards should be passed along to the vault owner if they're NOT staked
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
        });
        it('should work when assets are claimed and staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            // Don't stake anything on the first go-around. We need the esGMX to initialize vesting
            await (0, utils_1.waitDays)(30);
            await vault.handleRewards(true, false, true, false, false, true, false);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            const glpVestableAmount = await core.gmxEcosystem.vGlp.getMaxVestableAmount(vault.address);
            const gmxVestableAmount = await core.gmxEcosystem.vGmx.getMaxVestableAmount(vault.address);
            (0, chai_1.expect)(glpVestableAmount.gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            (0, chai_1.expect)(gmxVestableAmount.gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            await vault.vestGlp(glpVestableAmount);
            await vault.vestGmx(gmxVestableAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const stakedGmx = await core.gmxEcosystem.vGmx.pairAmounts(vault.address);
            await (0, utils_1.waitDays)(366);
            const sbfGmxBalanceBefore = await core.gmxEcosystem.sbfGmx.balanceOf(vault.address);
            await vault.handleRewards(true, true, true, true, true, true, false);
            const sbfGmxBalanceAfter = await core.gmxEcosystem.sbfGmx.balanceOf(vault.address);
            // the esGMX should have been converted to GMX and staked into sbfGMX
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).gt(esGmxAmount.add(gmxAmount).sub(stakedGmx)))
                .to
                .eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // GMX rewards should be passed along to the vault as sbfGMX if they're staked
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(sbfGmxBalanceAfter.gt(sbfGmxBalanceBefore)).to.eq(true);
        });
        it('should work when assets are claimed and not staked and deposited into Dolomite', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewards(true, false, true, false, true, true, true);
            (0, chai_1.expect)((await core.gmxEcosystem.esGmx.balanceOf(vault.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const balance2 = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
            (0, chai_1.expect)(balance2.sign).to.eq(true);
            (0, chai_1.expect)(balance2.value.eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
        });
        it('should work when assets are not claimed and not staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewards(false, false, false, false, false, false, false);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
            (0, chai_1.expect)(balance2.sign).to.eq(false);
            (0, chai_1.expect)(balance2.value).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when reentrancy is triggered', async () => {
            await (0, assertions_1.expectThrow)(vault.callHandleRewardsAndTriggerReentrancy(false, false, false, false, false, false, false), 'IsolationModeTokenVaultV1: Reentrant call');
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2)
                .handleRewards(false, false, false, false, false, false, false), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when attempting to deposit WETH when not claiming', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await (0, assertions_1.expectThrow)(vault.handleRewards(true, false, true, false, true, false, true), 'GLPIsolationModeTokenVaultV1: Can only deposit ETH if claiming');
        });
    });
    describe('#handleRewardsWithSpecificDepositAccountNumber', () => {
        const accountNumber = ethers_1.BigNumber.from(123);
        async function setupGmxStakingAndEsGmxVesting() {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).gte(gmxAmount)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.eq(no_deps_constants_1.ZERO_BI);
        }
        it('should work when assets are claimed and not staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, true, true, false, accountNumber);
            (0, chai_1.expect)((await core.gmxEcosystem.esGmx.balanceOf(vault.address)).gt(esGmxAmount)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            await vault.vestGlp(esGmxAmount);
            await vault.vestGmx(esGmxAmount);
            await (0, utils_1.waitDays)(366);
            await vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, true, true, false, accountNumber);
            // GMX rewards should be passed along to the vault owner if they're NOT staked
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
        });
        it('should work when assets are claimed and staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            // Don't stake anything on the first go-around. We need the esGMX to initialize vesting
            await (0, utils_1.waitDays)(30);
            await vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, false, true, false, accountNumber);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            const glpVestableAmount = await core.gmxEcosystem.vGlp.getMaxVestableAmount(vault.address);
            const gmxVestableAmount = await core.gmxEcosystem.vGmx.getMaxVestableAmount(vault.address);
            (0, chai_1.expect)(glpVestableAmount.gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            (0, chai_1.expect)(gmxVestableAmount.gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            await vault.vestGlp(glpVestableAmount);
            await vault.vestGmx(gmxVestableAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const stakedGmx = await core.gmxEcosystem.vGmx.pairAmounts(vault.address);
            await (0, utils_1.waitDays)(366);
            const sbfGmxBalanceBefore = await core.gmxEcosystem.sbfGmx.balanceOf(vault.address);
            await vault.handleRewardsWithSpecificDepositAccountNumber(true, true, true, true, true, true, false, accountNumber);
            const sbfGmxBalanceAfter = await core.gmxEcosystem.sbfGmx.balanceOf(vault.address);
            // the esGMX should have been converted to GMX and staked into sbfGMX
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).gt(esGmxAmount.add(gmxAmount).sub(stakedGmx)))
                .to
                .eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // GMX rewards should be passed along to the vault as sbfGMX if they're staked
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(sbfGmxBalanceAfter.gt(sbfGmxBalanceBefore)).to.eq(true);
        });
        it('should work when assets are claimed and not staked and deposited into Dolomite', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, true, true, true, accountNumber);
            (0, chai_1.expect)((await core.gmxEcosystem.esGmx.balanceOf(vault.address)).gt(no_deps_constants_1.ZERO_BI)).to.eq(true);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const account = { owner: core.hhUser1.address, number: accountNumber };
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
            (0, chai_1.expect)(balance2.sign).to.eq(true);
            (0, chai_1.expect)(balance2.value.eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
        });
        it('should work when assets are not claimed and not staked', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await vault.handleRewardsWithSpecificDepositAccountNumber(false, false, false, false, false, false, false, accountNumber);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            // The user has not vested any esGMX into GMX, so the balance should be 0
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const account = { owner: core.hhUser1.address, number: accountNumber };
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
            (0, chai_1.expect)(balance2.sign).to.eq(false);
            (0, chai_1.expect)(balance2.value).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when reentrancy is triggered', async () => {
            await (0, assertions_1.expectThrow)(vault.callHandleRewardsWithSpecificDepositAccountNumberAndTriggerReentrancy(false, false, false, false, false, false, false, accountNumber), 'IsolationModeTokenVaultV1: Reentrant call');
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2)
                .handleRewardsWithSpecificDepositAccountNumber(false, false, false, false, false, false, false, accountNumber), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
        it('should fail when attempting to deposit WETH when not claiming', async () => {
            await setupGmxStakingAndEsGmxVesting();
            await (0, utils_1.waitDays)(30);
            await (0, assertions_1.expectThrow)(vault.handleRewardsWithSpecificDepositAccountNumber(true, false, true, false, true, false, true, accountNumber), 'GLPIsolationModeTokenVaultV1: Can only deposit ETH if claiming');
        });
    });
    describe('#stakeGmx', () => {
        it('should work normally', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
        });
        it('should work when GMX is already approved for staking', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.setApprovalForGmxForStaking(gmxAmount.div(2)); // use an amount < gmxAmount
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).stakeGmx(gmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#unstakeGmx', () => {
        it('should work normally', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            await vault.unstakeGmx(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).unstakeGmx(gmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#stakeEsGmx', () => {
        it('should work when GMX is vesting', async () => {
            await doHandleRewardsWithWaitTime(30);
            const esGmx = core.gmxEcosystem.esGmx;
            const originalBalance = await esGmx.balanceOf(vault.address);
            await vault.stakeEsGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.esGmxBalanceOf()).to.eq(originalBalance);
            (0, chai_1.expect)(await core.gmxEcosystem.sGmx.depositBalances(vault.address, esGmx.address)).to.eq(esGmxAmount);
            (0, chai_1.expect)(await esGmx.balanceOf(vault.address)).to.eq(originalBalance.sub(esGmxAmount));
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(esGmxAmount);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).stakeEsGmx(esGmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#unstakeEsGmx', () => {
        it('should work normally', async () => {
            await doHandleRewardsWithWaitTime(30);
            const esGmx = core.gmxEcosystem.esGmx;
            const originalBalance = await esGmx.balanceOf(vault.address);
            await vault.stakeEsGmx(esGmxAmount);
            await vault.unstakeEsGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.esGmxBalanceOf()).to.eq(originalBalance);
            (0, chai_1.expect)(await core.gmxEcosystem.sGmx.depositBalances(vault.address, esGmx.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await esGmx.balanceOf(vault.address)).to.eq(originalBalance);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).unstakeEsGmx(esGmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#vestGlp', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.getGlpAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(no_deps_constants_1.ZERO_BI);
            await doHandleRewardsWithWaitTime(30);
            const glpAmountVested = await vault.getGlpAmountNeededForEsGmxVesting(esGmxAmount);
            await vault.vestGlp(esGmxAmount);
            const amountInVesting = await core.gmxEcosystem.vGlp.pairAmounts(vault.address);
            // the amount of GLP in the vault should be unchanged if some of it moves into vesting
            (0, chai_1.expect)(amountInVesting).to.eq(glpAmountVested);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(amountWei);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(vault.address)).to.eq(amountWei.sub(amountInVesting));
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).vestGlp(esGmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#unvestGlp', () => {
        it('should work GLP is staked', async () => {
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGlp(esGmxAmount);
            await (0, utils_1.waitDays)(366);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            await vault.unvestGlp(true);
            (0, chai_1.expect)((await vault.gmxBalanceOf()).eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(vault.address))).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address))).to.eq(no_deps_constants_1.ZERO_BI);
        });
        it('should work GLP is withdrawn', async () => {
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGlp(esGmxAmount);
            await (0, utils_1.waitDays)(366);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            await vault.unvestGlp(false);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).unvestGlp(false), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#vestGmx', () => {
        it('should work normally', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
            (0, chai_1.expect)(await vault.getGmxAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(no_deps_constants_1.ZERO_BI);
            await doHandleRewardsWithWaitTime(30);
            const gmxAmountVested = await vault.getGmxAmountNeededForEsGmxVesting(esGmxAmount);
            await vault.vestGmx(esGmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.vGmx.pairAmounts(vault.address)).to.eq(gmxAmountVested);
            // the amount of GMX in the vault should be unchanged if some of it moves into vesting
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).gt(gmxAmount.sub(gmxAmountVested))).to.eq(true);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).vestGmx(esGmxAmount), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#unvestGmx', () => {
        it('should work when GMX is re-staked', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            await (0, utils_1.waitDays)(366);
            await vault.unvestGmx(true);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
        });
        it('should work when vested GMX is withdrawn', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            await (0, utils_1.waitDays)(366);
            await vault.unvestGmx(false);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(esGmxAmount);
        });
        it('should fail when not called by vault owner', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).unvestGmx(false), `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#acceptFullAccountTransfer', () => {
        it('should work when the vault has had no interactions with GMX', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, core.gmxEcosystem.sGmx);
            const usdcAmount = ethers_1.BigNumber.from('100000000'); // 100 USDC
            await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
            await core.gmxEcosystem.glpRewardsRouter.mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, no_deps_constants_1.ONE_BI, no_deps_constants_1.ONE_BI);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser1).stakeGmx(gmxAmount);
            const glpAmount = await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser1.address);
            await (0, utils_1.waitDays)(30);
            await core.gmxEcosystem.gmxRewardsRouter.handleRewards(true, false, true, false, true, true, true);
            const totalEsGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address);
            const depositEsGmxAmount = totalEsGmxAmount.div(2);
            const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);
            const vaultAddress = await factory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser1).signalTransfer(vaultAddress);
            await factory.createVault(core.hhUser2.address);
            const newVault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.GLPIsolationModeTokenVaultV1__factory, core.hhUser2);
            await newVault.acceptFullAccountTransfer(core.hhUser1.address);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
            (0, chai_1.expect)((await core.gmxEcosystem.sbfGmx.balanceOf(vaultAddress)).eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
        });
        it('should fail when triggered more than once on the same vault', async () => {
            await core.gmxEcosystem.esGmxDistributor.setTokensPerInterval('0');
            const usdcAmount = ethers_1.BigNumber.from('100000000'); // 100 USDC
            await (0, setup_1.setupUSDCBalance)(core, core.hhUser2, usdcAmount, core.gmxEcosystem.glpManager);
            await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, no_deps_constants_1.ONE_BI, no_deps_constants_1.ONE_BI);
            const glpAmount = await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser2.address);
            const vaultAddress = await factory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser2).signalTransfer(vaultAddress);
            await factory.createVault(core.hhUser2.address);
            const newVault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.GLPIsolationModeTokenVaultV1__factory, core.hhUser2);
            (0, chai_1.expect)(await newVault.hasAcceptedFullAccountTransfer()).to.eq(false);
            await newVault.acceptFullAccountTransfer(core.hhUser2.address);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser2.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser2.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(core.hhUser2.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.sbfGmx.balanceOf(vaultAddress)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await newVault.hasAcceptedFullAccountTransfer()).to.eq(true);
            await (0, setup_1.setupUSDCBalance)(core, core.hhUser2, usdcAmount, core.gmxEcosystem.glpManager);
            await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, no_deps_constants_1.ONE_BI, no_deps_constants_1.ONE_BI);
            await core.gmxEcosystem.gmxRewardsRouter.connect(core.hhUser2).signalTransfer(vaultAddress);
            await (0, assertions_1.expectThrow)(newVault.acceptFullAccountTransfer(core.hhUser2.address), 'GLPIsolationModeTokenVaultV1: Cannot transfer more than once');
        });
        it('should fail when sender is the zero addres', async () => {
            await (0, assertions_1.expectThrow)(vault.acceptFullAccountTransfer(Addresses_1.ZERO_ADDRESS), 'GLPIsolationModeTokenVaultV1: Invalid sender');
        });
        it('should fail when reentrancy is triggered in the user vault', async () => {
            await (0, assertions_1.expectThrow)(vault.callAcceptFullAccountTransferAndTriggerReentrancy(core.hhUser1.address), 'IsolationModeTokenVaultV1: Reentrant call');
        });
        it('should fail when not called by vault owner or factory', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).acceptFullAccountTransfer(core.hhUser2.address), `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#executeDepositIntoVault', () => {
        it('should fail when not called by vault factory', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser2.address, amountWei), `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#executeWithdrawalFromVault', () => {
        it('should work normally', async () => {
            await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser1.address)).to.equal(glpAmount);
        });
        it('should work when GLP needs to be un-vested', async () => {
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.equal(no_deps_constants_1.ZERO_BI);
            await doHandleRewardsWithWaitTime(30);
            const esGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(vault.address);
            await vault.vestGlp(esGmxAmount);
            await (0, utils_1.waitDays)(366); // vest the GLP
            const glpInVesting = await core.gmxEcosystem.vGlp.pairAmounts(vault.address);
            (0, chai_1.expect)(glpInVesting.eq(no_deps_constants_1.ZERO_BI)).to.eq(false);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(vault.address)).to.eq(amountWei.sub(glpInVesting));
            await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.gmxEcosystem.fsGlp.balanceOf(core.hhUser1.address)).to.equal(glpAmount);
            (0, chai_1.expect)(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.equal(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)((await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).eq(no_deps_constants_1.ZERO_BI)).to.equal(false);
        });
        it('should fail when not called by vault factory', async () => {
            await (0, assertions_1.expectThrow)(vault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser2.address, amountWei), `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`);
        });
    });
    describe('#gmxRewardsRouter', () => {
        it('should work normally', async () => {
            (0, chai_1.expect)(await vault.gmxRewardsRouter()).to.equal(core.gmxEcosystem.gmxRewardsRouter.address);
        });
    });
    describe('#underlyingBalanceOf', () => {
        it('should work when funds are only in vault', async () => {
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(amountWei);
        });
        it('should work when funds are in vault and vesting', async () => {
            await doHandleRewardsWithWaitTime(30);
            const esGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(vault.address);
            await vault.vestGlp(esGmxAmount);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.equal(amountWei); // amount should be unchanged
        });
    });
    describe('#gmxBalanceOf', () => {
        it('should work when GMX is vesting and staked', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
        });
        it('should work when GMX is vesting, staked, and idle', async () => {
            await (0, setup_1.setupGMXBalance)(core, core.hhUser1, gmxAmount, vault);
            await vault.stakeGmx(gmxAmount);
            await doHandleRewardsWithWaitTime(30);
            await vault.vestGmx(esGmxAmount);
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(gmxAmount);
        });
        it('should work when no GMX is deposited at all', async () => {
            (0, chai_1.expect)(await vault.gmxBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
        });
    });
});

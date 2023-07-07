"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
const sdk_v2_1 = require("@pendle/sdk-v2");
const ChainId_1 = require("@pendle/sdk-v2/dist/common/ChainId");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const pendle_1 = require("../../utils/ecosystem-token-utils/pendle");
const setup_1 = require("../../utils/setup");
const pendle_utils_1 = require("./pendle-utils");
const defaultAccountNumber = '0';
const amountWei = ethers_1.BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = ethers_1.BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const FIVE_BIPS = 0.0005;
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
describe('PendlePtGLP2024IsolationModeWrapperTraderV2', () => {
    let snapshotId;
    let core;
    let underlyingToken;
    let underlyingMarketId;
    let gmxRegistry;
    let pendleRegistry;
    let unwrapper;
    let wrapper;
    let factory;
    let vault;
    let priceOracle;
    let defaultAccount;
    let router;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = core.pendleEcosystem.ptGlpToken.connect(core.hhUser1);
        const userVaultImplementation = await (0, pendle_1.createPendlePtGLP2024IsolationModeTokenVaultV1)();
        gmxRegistry = core.gmxEcosystem.live.gmxRegistry;
        pendleRegistry = await (0, pendle_1.createPendlePtGLP2024Registry)(core);
        factory = await (0, pendle_1.createPendlePtGLP2024IsolationModeVaultFactory)(core, pendleRegistry, underlyingToken, userVaultImplementation);
        unwrapper = await (0, pendle_1.createPendlePtGLP2024IsolationModeUnwrapperTraderV2)(core, factory, pendleRegistry);
        wrapper = await (0, pendle_1.createPendlePtGLP2024IsolationModeWrapperTraderV2)(core, factory, pendleRegistry);
        priceOracle = await (0, pendle_1.createPendlePtGLPPriceOracle)(core, factory, pendleRegistry);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);
        await factory.connect(core.governance).ownerInitialize([wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory, core.hhUser1);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        router = sdk_v2_1.Router.getRouter({
            chainId: ChainId_1.CHAIN_ID_MAPPING.ARBITRUM,
            provider: core.hhUser1.provider,
            signer: core.hhUser1,
        });
        const usdcAmount = amountWei.div(1e12).mul(8);
        const usableUsdcAmount = usdcAmount.div(2);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usableUsdcAmount, 0, 0);
        const glpAmount = amountWei.mul(4);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.pendleEcosystem.pendleRouter.address, glpAmount);
        await router.swapExactTokenForPt(core.pendleEcosystem.ptGlpMarket.address, core.gmxEcosystem.sGlp.address, glpAmount, FIVE_BIPS);
        await core.pendleEcosystem.ptGlpToken.connect(core.hhUser1).approve(vault.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
        (0, chai_1.expect)((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Call and Exchange for non-liquidation sale', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const glpAmount = await core.gmxEcosystem.live.glpIsolationModeWrapperTraderV1.connect(core.hhUser5)
                .getExchangeCost(core.tokens.usdc.address, core.tokens.dfsGlp.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY);
            const { extraOrderData, approxParams } = await (0, pendle_utils_1.encodeSwapExactTokensForPt)(router, core, glpAmount);
            const actions = await wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, underlyingMarketId, core.marketIds.usdc, no_deps_constants_1.ZERO_BI, usableUsdcAmount, extraOrderData);
            await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
            (0, chai_1.expect)(underlyingBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(false);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(usableUsdcAmount);
            await (0, assertions_1.expectWalletBalance)(wrapper.address, core.tokens.usdc, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(wrapper.address, core.gmxEcosystem.fsGlp, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectWalletBalance)(wrapper.address, core.pendleEcosystem.ptGlpToken, no_deps_constants_1.ZERO_BI);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(wrapper.connect(core.hhUser1).exchange(vault.address, core.dolomiteMargin.address, factory.address, core.tokens.usdc.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if trade originator is not a vault', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, factory.address, OTHER_ADDRESS, usableUsdcAmount, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), `IsolationModeWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is not whitelisted', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, factory.address, OTHER_ADDRESS, usableUsdcAmount, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), `IsolationModeWrapperTraderV2: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, amountWei, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the input amount is 0', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, factory.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), 'IsolationModeWrapperTraderV2: Invalid input amount');
        });
    });
    describe('#pendleVaultRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
        });
    });
    describe('#gmxRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should fail because it is not implemented', async () => {
            await (0, assertions_1.expectThrow)(wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), 'PendlePtGLP2024WrapperV2: getExchangeCost is not implemented');
        });
    });
});

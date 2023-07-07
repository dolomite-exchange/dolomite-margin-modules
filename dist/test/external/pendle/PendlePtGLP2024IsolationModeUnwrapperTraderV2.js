"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
describe('PendlePtGLP2024IsolationModeUnwrapperTraderV2', () => {
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
    let vaultSigner;
    let priceOracle;
    let defaultAccount;
    let router;
    let solidUser;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        underlyingToken = core.pendleEcosystem.ptGlpToken;
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
        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
        solidUser = core.hhUser5;
        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = (0, setup_1.setupUserVaultProxy)(vaultAddress, types_1.PendlePtGLP2024IsolationModeTokenVaultV1__factory, core.hhUser1);
        vaultSigner = await (0, utils_1.impersonate)(vault.address, true);
        defaultAccount = { owner: vault.address, number: defaultAccountNumber };
        router = sdk_v2_1.Router.getRouter({
            chainId: ChainId_1.CHAIN_ID_MAPPING.ARBITRUM,
            provider: core.hhUser1.provider,
            signer: core.hhUser1,
        });
        const usdcAmount = amountWei.div(1e12).mul(8);
        await (0, setup_1.setupUSDCBalance)(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
        await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
            .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
        const glpAmount = amountWei.mul(4);
        await core.gmxEcosystem.sGlp.connect(core.hhUser1)
            .approve(core.pendleEcosystem.pendleRouter.address, glpAmount);
        await router.swapExactTokenForPt(core.pendleEcosystem.ptGlpMarket.address, core.gmxEcosystem.sGlp.address, glpAmount, pendle_utils_1.ONE_TENTH_OF_ONE_BIPS_NUMBER);
        await core.pendleEcosystem.ptGlpToken.connect(core.hhUser1).approve(vault.address, amountWei);
        await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
        (0, chai_1.expect)(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
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
            const { tokenOutput, extraOrderData } = await (0, pendle_utils_1.encodeSwapExactPtForTokens)(router, core, amountWei);
            const amountOut = await core.gmxEcosystem.live.glpIsolationModeUnwrapperTraderV1.connect(core.hhUser5)
                .getExchangeCost(core.tokens.dfsGlp.address, core.tokens.usdc.address, tokenOutput.minTokenOut, no_deps_constants_1.BYTES_EMPTY);
            const actions = await unwrapper.createActionsForUnwrapping(solidAccountId, liquidAccountId, vault.address, vault.address, core.marketIds.usdc, underlyingMarketId, amountOut, amountWei, extraOrderData);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(no_deps_constants_1.ZERO_BI);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(otherBalanceWei.value).to.be.gt(amountOut);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.connect(core.hhUser1).exchange(vault.address, core.dolomiteMargin.address, core.tokens.usdc.address, factory.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.usdc.address, core.tokens.weth.address, amountWei, no_deps_constants_1.BYTES_EMPTY), `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.pendleEcosystem.ptGlpToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.dfsGlp.address, factory.address, amountWei, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp.address.toLowerCase()}>`);
        });
        it('should fail if input amount is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await core.pendleEcosystem.ptGlpToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
            await (0, assertions_1.expectThrow)(unwrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.usdc.address, factory.address, no_deps_constants_1.ZERO_BI, ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei])), 'IsolationModeUnwrapperTraderV2: Invalid input amount');
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
    describe('#pendleRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await unwrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should fail because it is not implemented', async () => {
            await (0, assertions_1.expectThrow)(unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, no_deps_constants_1.BYTES_EMPTY), 'PendlePtGLP2024UnwrapperV2: getExchangeCost is not implemented');
        });
    });
});

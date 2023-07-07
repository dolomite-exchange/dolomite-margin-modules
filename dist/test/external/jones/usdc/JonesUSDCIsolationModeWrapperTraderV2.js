"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Addresses_1 = require("@openzeppelin/upgrades/lib/utils/Addresses");
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
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
describe('JonesUSDCIsolationModeWrapperTraderV2', () => {
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
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        underlyingToken = core.jonesEcosystem.jUSDC.connect(core.hhUser1);
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        gmxRegistry = core.gmxEcosystem.live.gmxRegistry;
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, core.jonesEcosystem.jUSDC, userVaultImplementation);
        unwrapper = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapper.address);
        wrapper = await (0, jones_1.createJonesUSDCIsolationModeWrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await (0, jones_utils_1.createRoleAndWhitelistTrader)(core, unwrapper, wrapper);
        priceOracle = await (0, jones_1.createJonesUSDCPriceOracle)(core, jonesUSDCRegistry, factory);
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.usdc);
        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, priceOracle);
        await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);
        await factory.connect(core.governance).ownerInitialize([wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
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
    describe('Call and Exchange for non-liquidation sale', () => {
        it('should work when called with the normal conditions', async () => {
            const solidAccountId = 0;
            const liquidAccountId = 0;
            const actions = await wrapper.createActionsForWrapping(solidAccountId, liquidAccountId, Addresses_1.ZERO_ADDRESS, Addresses_1.ZERO_ADDRESS, underlyingMarketId, core.marketIds.usdc, no_deps_constants_1.ZERO_BI, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY);
            await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
            await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
            const result = await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);
            // jUSDC's value goes up every second. To get the correct amountOut, we need to use the same block #
            const amountOut = await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY, { blockTag: result.blockNumber });
            const expectedTotalBalance = amountWei.add(amountOut);
            const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
            (0, chai_1.expect)(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
            (0, chai_1.expect)(underlyingBalanceWei.sign).to.eq(true);
            (0, chai_1.expect)(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);
            const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
            (0, chai_1.expect)(otherBalanceWei.sign).to.eq(false);
            (0, chai_1.expect)(otherBalanceWei.value).to.eq(usableUsdcAmount);
        });
    });
    describe('#exchange', () => {
        it('should fail if not called by DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(wrapper.connect(core.hhUser1).exchange(vault.address, core.dolomiteMargin.address, factory.address, core.tokens.usdc.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if for invalid trade originator called by DolomiteMargin', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(core.hhUser1.address, core.dolomiteMargin.address, factory.address, core.tokens.usdc.address, usableUsdcAmount, no_deps_constants_1.BYTES_EMPTY), `IsolationModeWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail if input token is not whitelisted', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, factory.address, OTHER_ADDRESS, usableUsdcAmount, abiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), `IsolationModeWrapperTraderV2: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`);
        });
        it('should fail if output token is incorrect', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, amountWei, abiCoder.encode(['uint256'], [otherAmountWei])), `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`);
        });
        it('should fail if the input amount is 0', async () => {
            const dolomiteMarginImpersonator = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            await (0, assertions_1.expectThrow)(wrapper.connect(dolomiteMarginImpersonator).exchange(vault.address, core.dolomiteMargin.address, factory.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, abiCoder.encode(['uint256'], [no_deps_constants_1.ZERO_BI])), 'IsolationModeWrapperTraderV2: Invalid input amount');
        });
    });
    describe('#jonesUSDCRegistry', () => {
        it('should work', async () => {
            (0, chai_1.expect)(await wrapper.JONES_USDC_REGISTRY()).to.eq(jonesUSDCRegistry.address);
        });
    });
    describe('#getExchangeCost', () => {
        it('should work normally', async () => {
            const receiptToken = core.jonesEcosystem.usdcReceiptToken.connect(core.hhUser1);
            const receiptTokenExchangeRateNumerator = await receiptToken.totalAssets();
            const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
            const receiptTokenExchangeRateDenominator = await await receiptToken.totalSupply();
            const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();
            const inputAmount = usableUsdcAmount;
            const expectedAmount = inputAmount
                .mul(receiptTokenExchangeRateDenominator)
                .div(receiptTokenExchangeRateNumerator)
                .mul(jUSDCExchangeRateDenominator)
                .div(jUSDCExchangeRateNumerator);
            (0, chai_1.expect)(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, inputAmount, no_deps_constants_1.BYTES_EMPTY))
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
                const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
                const expectedAmount = weirdAmount
                    .mul(receiptTokenExchangeRateDenominator)
                    .div(receiptTokenExchangeRateNumerator)
                    .mul(jUSDCExchangeRateDenominator)
                    .div(jUSDCExchangeRateNumerator);
                (0, chai_1.expect)(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, weirdAmount, no_deps_constants_1.BYTES_EMPTY))
                    .to
                    .eq(expectedAmount);
            }
        });
    });
});

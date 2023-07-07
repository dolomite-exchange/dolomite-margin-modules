"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const umami_1 = require("../../utils/ecosystem-token-utils/umami");
const setup_1 = require("../../utils/setup");
const LINK_PRICE = ethers_1.BigNumber.from('6615143750000000000'); // $6.61514375
const USDC_PRICE = ethers_1.BigNumber.from('1000000000000000000000000000000'); // $1.00
const WBTC_PRICE = ethers_1.BigNumber.from('310005100000000000000000000000000'); // $31,000.51
const WETH_PRICE = ethers_1.BigNumber.from('1964129009030000000000'); // $1964.12900903
const prices = [LINK_PRICE, USDC_PRICE, WBTC_PRICE, WETH_PRICE];
const UMAMI_LINK_PRICE = ethers_1.BigNumber.from('6627676807866578059');
const UMAMI_USDC_PRICE = ethers_1.BigNumber.from('1013685904999300592616624183877'); // $1.0131...
const UMAMI_WBTC_PRICE = ethers_1.BigNumber.from('315162914422051769717547981804418');
const UMAMI_WETH_PRICE = ethers_1.BigNumber.from('1990936356560813328593');
const umamiPrices = [UMAMI_LINK_PRICE, UMAMI_USDC_PRICE, UMAMI_WBTC_PRICE, UMAMI_WETH_PRICE];
describe('UmamiAssetVaultPriceOracle', () => {
    let snapshotId;
    let core;
    let umamiRegistry;
    let userVaultImplementation;
    let umamiAssetVaultPriceOracles;
    let factories;
    let marketIds;
    let underlyingAssets;
    let umamiAssets;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)((0, setup_1.getDefaultCoreProtocolConfig)(no_deps_constants_1.Network.ArbitrumOne));
        umamiRegistry = await (0, umami_1.createUmamiAssetVaultRegistry)(core);
        userVaultImplementation = await (0, umami_1.createUmamiAssetVaultIsolationModeTokenVaultV1)();
        const umamiEcosystem = core.umamiEcosystem;
        umamiAssets = [umamiEcosystem.glpLink, umamiEcosystem.glpUsdc, umamiEcosystem.glpWbtc, umamiEcosystem.glpWeth];
        underlyingAssets = [core.tokens.link, core.tokens.usdc, core.tokens.wbtc, core.tokens.weth];
        factories = await Promise.all(umamiAssets.map((asset, i) => (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, umamiRegistry, asset, underlyingAssets[i], userVaultImplementation)));
        umamiAssetVaultPriceOracles = await Promise.all(factories.map((factory) => (0, umami_1.createUmamiAssetVaultPriceOracle)(core, umamiRegistry, factory)));
        const firstMarketId = await core.dolomiteMargin.getNumMarkets();
        marketIds = Array.from({ length: umamiAssets.length }, (_, i) => firstMarketId.add(i));
        for (let i = 0; i < factories.length; i++) {
            await (0, setup_1.setupTestMarket)(core, factories[i], true, umamiAssetVaultPriceOracles[i]);
        }
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for all assets', async () => {
            for (let i = 0; i < factories.length; i++) {
                const price = await umamiAssetVaultPriceOracles[i].getPrice(factories[i].address);
                (0, chai_1.expect)(price.value).to.eq(umamiPrices[i], `Incorrect price for ${await umamiAssets[i].symbol()}`);
            }
        });
        it('returns the correct value when total supply is 0', async () => {
            for (let i = 0; i < underlyingAssets.length; i++) {
                const testToken = await (0, dolomite_utils_1.createTestVaultToken)(underlyingAssets[i]);
                await core.testPriceOracle.setPrice(testToken.address, prices[i]);
                await (0, setup_1.setupTestMarket)(core, testToken, false, core.testPriceOracle);
                const newFactory = await (0, umami_1.createUmamiAssetVaultIsolationModeVaultFactory)(core, umamiRegistry, testToken, underlyingAssets[i], userVaultImplementation);
                const umamiAssetVaultPriceOracle = await (0, umami_1.createUmamiAssetVaultPriceOracle)(core, umamiRegistry, newFactory);
                await (0, setup_1.setupTestMarket)(core, newFactory, true, umamiAssetVaultPriceOracle);
                const price = await umamiAssetVaultPriceOracle.getPrice(newFactory.address);
                const withdrawalFee = prices[i].mul(75).div(10000); // withdrawal fee is 75 bps
                (0, chai_1.expect)(price.value).to.eq(prices[i].sub(withdrawalFee));
            }
        });
        it('fails when token sent is not the valid Umami Asset', async () => {
            for (let i = 0; i < umamiAssetVaultPriceOracles.length; i++) {
                await (0, assertions_1.expectThrow)(umamiAssetVaultPriceOracles[i].getPrice(dolomite_margin_1.ADDRESSES.ZERO), `UmamiAssetVaultPriceOracle: Invalid token <${dolomite_margin_1.ADDRESSES.ZERO}>`);
                await (0, assertions_1.expectThrow)(umamiAssetVaultPriceOracles[i].getPrice(core.gmxEcosystem.fsGlp.address), `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem.fsGlp.address.toLowerCase()}>`);
                await (0, assertions_1.expectThrow)(umamiAssetVaultPriceOracles[i].getPrice(core.tokens.dfsGlp.address), `UmamiAssetVaultPriceOracle: Invalid token <${(core.tokens.dfsGlp.address).toLowerCase()}>`);
                await (0, assertions_1.expectThrow)(umamiAssetVaultPriceOracles[i].getPrice(core.gmxEcosystem.glp.address), `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem.glp.address.toLowerCase()}>`);
            }
        });
        it('fails when assets are borrowable', async () => {
            for (let i = 0; i < marketIds.length; i++) {
                await core.dolomiteMargin.ownerSetIsClosing(marketIds[i], false);
                await (0, assertions_1.expectThrow)(umamiAssetVaultPriceOracles[i].getPrice(factories[i].address), 'UmamiAssetVaultPriceOracle: Umami Asset cannot be borrowable');
            }
        });
    });
});

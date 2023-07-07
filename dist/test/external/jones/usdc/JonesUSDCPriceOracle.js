"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../../src/utils/no-deps-constants");
const utils_1 = require("../../../utils");
const assertions_1 = require("../../../utils/assertions");
const jones_1 = require("../../../utils/ecosystem-token-utils/jones");
const setup_1 = require("../../../utils/setup");
const USDC_PRICE = ethers_1.BigNumber.from('999904540000000000000000000000'); // $0.99990454
const JONES_USDC_PRICE = ethers_1.BigNumber.from('1021871542224830000'); // $1.02187...
describe('JonesUSDCPriceOracle', () => {
    let snapshotId;
    let core;
    let jonesUSDCPriceOracle;
    let jonesUSDCRegistry;
    let factory;
    let unwrapperTrader;
    let marketId;
    before(async () => {
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: 86413000,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        jonesUSDCRegistry = await (0, jones_1.createJonesUSDCRegistry)(core);
        const userVaultImplementation = await (0, jones_1.createJonesUSDCIsolationModeTokenVaultV1)();
        factory = await (0, jones_1.createJonesUSDCIsolationModeVaultFactory)(core, jonesUSDCRegistry, core.jonesEcosystem.jUSDC, userVaultImplementation);
        unwrapperTrader = await (0, jones_1.createJonesUSDCIsolationModeUnwrapperTraderV2)(core, jonesUSDCRegistry, factory);
        await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapperTrader.address);
        jonesUSDCPriceOracle = await (0, jones_1.createJonesUSDCPriceOracle)(core, jonesUSDCRegistry, factory);
        marketId = await core.dolomiteMargin.getNumMarkets();
        await (0, setup_1.setupTestMarket)(core, factory, true, jonesUSDCPriceOracle);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for djUSDC', async () => {
            const price = await jonesUSDCPriceOracle.getPrice(factory.address);
            (0, chai_1.expect)(price.value).to.eq(JONES_USDC_PRICE);
        });
        it('returns the correct value jUSDC has a total supply of 0', async () => {
            const testToken = await (0, dolomite_utils_1.createTestToken)();
            await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDC(testToken.address);
            const price = await jonesUSDCPriceOracle.getPrice(factory.address);
            const usdcPrice = USDC_PRICE.div(1e12);
            const retentionFee = usdcPrice.mul(97).div(10000);
            (0, chai_1.expect)(price.value).to.eq(usdcPrice.sub(retentionFee));
        });
        it('fails when token sent is not djUSDC', async () => {
            await (0, assertions_1.expectThrow)(jonesUSDCPriceOracle.getPrice(dolomite_margin_1.ADDRESSES.ZERO), `JonesUSDCPriceOracle: Invalid token <${dolomite_margin_1.ADDRESSES.ZERO}>`);
            await (0, assertions_1.expectThrow)(jonesUSDCPriceOracle.getPrice(core.gmxEcosystem.fsGlp.address), `JonesUSDCPriceOracle: Invalid token <${core.gmxEcosystem.fsGlp.address.toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(jonesUSDCPriceOracle.getPrice(core.tokens.dfsGlp.address), `JonesUSDCPriceOracle: Invalid token <${(core.tokens.dfsGlp.address).toLowerCase()}>`);
            await (0, assertions_1.expectThrow)(jonesUSDCPriceOracle.getPrice(core.gmxEcosystem.glp.address), `JonesUSDCPriceOracle: Invalid token <${core.gmxEcosystem.glp.address.toLowerCase()}>`);
        });
        it('fails when jUSDC is borrowable', async () => {
            await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
            await (0, assertions_1.expectThrow)(jonesUSDCPriceOracle.getPrice(factory.address), 'JonesUSDCPriceOracle: jUSDC cannot be borrowable');
        });
    });
});

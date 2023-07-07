"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const liquidation_utils_1 = require("../../utils/liquidation-utils");
const setup_1 = require("../../utils/setup");
const USDC_PRICE = ethers_1.BigNumber.from('1000000000000000000000000000000');
const solidNumber = '321';
const liquidNumber = '123';
const FIFTY_BPS = ethers_1.BigNumber.from('50');
describe('LiquidatorProxyV2WithExternalLiquidity', () => {
    let core;
    let governance;
    let solidAccount;
    let liquidAccount;
    let solidAccountStruct;
    let liquidAccountStruct;
    let dolomiteMargin;
    let liquidatorProxy;
    let testPriceOracle;
    let snapshotId;
    before(async () => {
        const blockNumber = await (0, utils_1.getRealLatestBlockNumber)(true, no_deps_constants_1.Network.ArbitrumOne);
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        governance = core.governance;
        solidAccount = core.hhUser1;
        liquidAccount = core.hhUser2;
        solidAccountStruct = { owner: solidAccount.address, number: ethers_1.BigNumber.from(solidNumber) };
        liquidAccountStruct = { owner: liquidAccount.address, number: ethers_1.BigNumber.from(liquidNumber) };
        dolomiteMargin = core.dolomiteMargin;
        liquidatorProxy = core.liquidatorProxyV2.connect(solidAccount);
        const owner = await (0, utils_1.impersonate)(governance.address, true);
        (0, chai_1.expect)(await dolomiteMargin.getIsGlobalOperator(liquidatorProxy.address)).to.eql(true);
        testPriceOracle = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestPriceOracle__factory.abi, types_1.TestPriceOracle__factory.bytecode, []);
        await testPriceOracle.setPrice(core.tokens.usdc.address, USDC_PRICE);
        await dolomiteMargin.connect(owner).ownerSetPriceOracle(core.marketIds.usdc, testPriceOracle.address);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#liquidate', () => {
        async function setupUserBalance() {
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.weth, 0);
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.usdc, 0);
            const heldAmountWei = ethers_1.BigNumber.from('1000000000000000000'); // 1 ETH
            await (0, setup_1.setupWETHBalance)(core, liquidAccount, heldAmountWei, dolomiteMargin);
            await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, liquidAccount, liquidNumber, core.marketIds.weth, heldAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.weth, heldAmountWei);
            const owedAmountWei = (await dolomiteMargin.getAccountValues(liquidAccountStruct))[0]
                .value.div(USDC_PRICE).mul(100).div(125);
            // Decrease the user's collateralization to 125%
            await (0, dolomite_utils_1.withdrawFromDolomiteMargin)(core, liquidAccount, liquidNumber, core.marketIds.usdc, owedAmountWei);
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, owedAmountWei.mul(-1));
            return { heldAmountWei, owedAmountWei };
        }
        it('should work properly', async () => {
            const { heldAmountWei, owedAmountWei } = await setupUserBalance();
            // Increase the user's debt by 10%, therefore lowering the collateralization to ~113% (making it under-water)
            await testPriceOracle.setPrice(core.tokens.usdc.address, USDC_PRICE.mul(11).div(10));
            const owedPriceAdj = (await dolomiteMargin.getMarketPrice(core.marketIds.usdc)).value.mul(105).div(100);
            const heldPrice = (await dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
            const inputAmount = (0, dolomite_utils_1.owedWeiToHeldWei)(owedAmountWei, owedPriceAdj, heldPrice);
            console.log('\tLiquidating account:', liquidAccount.address);
            const { calldata: paraswapCallData, outputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(inputAmount, core.tokens.weth, 18, owedAmountWei, core.tokens.usdc, 6, solidAccount, liquidatorProxy, core);
            const txResult = await liquidatorProxy.liquidate(solidAccountStruct, liquidAccountStruct, core.marketIds.usdc, core.marketIds.weth, no_deps_constants_1.NO_EXPIRY, paraswapCallData);
            const receipt = await txResult.wait();
            console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
            await (0, assertions_1.expectProtocolBalance)(core, solidAccountStruct.owner, solidAccountStruct.number, core.marketIds.weth, 0);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, solidAccountStruct, core.marketIds.usdc, outputAmount.sub(owedAmountWei), FIFTY_BPS);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, liquidAccountStruct, core.marketIds.weth, heldAmountWei.sub(inputAmount), FIFTY_BPS);
            await (0, assertions_1.expectProtocolBalance)(core, liquidAccountStruct.owner, liquidAccountStruct.number, core.marketIds.usdc, 0);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, liquidatorProxy.address, core.tokens.weth.address, 0);
            await (0, assertions_1.expectWalletBalanceOrDustyIfZero)(core, liquidatorProxy.address, core.tokens.usdc.address, 0);
        });
    });
});

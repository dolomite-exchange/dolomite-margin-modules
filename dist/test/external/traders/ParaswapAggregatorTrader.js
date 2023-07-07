"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("@dolomite-margin/dist/src");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const no_deps_constants_1 = require("../../../src/utils/no-deps-constants");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
const traders_1 = require("../../utils/ecosystem-token-utils/traders");
const liquidation_utils_1 = require("../../utils/liquidation-utils");
const setup_1 = require("../../utils/setup");
const defaultAccountNumber = '0';
const amountIn = ethers_1.BigNumber.from('1000000000000000000');
const minAmountOut = ethers_1.BigNumber.from('123123123');
describe('ParaswapAggregatorTrader', () => {
    let snapshotId;
    let core;
    let trader;
    let defaultAccount;
    before(async () => {
        const latestBlockNumber = await (0, utils_1.getRealLatestBlockNumber)(true, no_deps_constants_1.Network.ArbitrumOne);
        core = await (0, setup_1.setupCoreProtocol)({
            blockNumber: latestBlockNumber,
            network: no_deps_constants_1.Network.ArbitrumOne,
        });
        trader = (await (0, traders_1.createParaswapAggregatorTrader)(core)).connect(core.hhUser1);
        defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };
        // prevent interest accrual between calls
        await (0, setup_1.disableInterestAccrual)(core, core.marketIds.weth);
        await (0, setup_1.setupWETHBalance)(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
        await (0, dolomite_utils_1.depositIntoDolomiteMargin)(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('#contructor', () => {
        it('should initialize variables properly', async () => {
            (0, chai_1.expect)(await trader.PARASWAP_AUGUSTUS_ROUTER()).to.equal(core.paraswapEcosystem.augustusRouter);
            (0, chai_1.expect)(await trader.PARASWAP_TRANSFER_PROXY()).to.equal(core.paraswapEcosystem.transferProxy);
        });
    });
    describe('#exchange', () => {
        it('should succeed under normal conditions', async () => {
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);
            const { calldata } = await (0, liquidation_utils_1.getCalldataForParaswap)(amountIn, core.tokens.weth, 18, minAmountOut, core.tokens.usdc, 6, core.dolomiteMargin, trader, core);
            const actualCalldata = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, calldata]);
            await core.dolomiteMargin.connect(core.hhUser1).operate([{ owner: core.hhUser1.address, number: defaultAccountNumber }], [
                {
                    actionType: src_1.ActionType.Sell,
                    primaryMarketId: core.marketIds.weth,
                    secondaryMarketId: core.marketIds.usdc,
                    accountId: 0,
                    otherAccountId: 0,
                    amount: { sign: false, denomination: src_1.AmountDenomination.Wei, ref: src_1.AmountReference.Delta, value: amountIn },
                    otherAddress: trader.address,
                    data: actualCalldata,
                },
            ]);
            (0, chai_1.expect)(await core.tokens.weth.balanceOf(trader.address)).to.eq(no_deps_constants_1.ZERO_BI);
            (0, chai_1.expect)(await core.tokens.usdc.balanceOf(trader.address)).to.eq(no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalance)(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, no_deps_constants_1.ZERO_BI);
            await (0, assertions_1.expectProtocolBalanceIsGreaterThan)(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
        });
        it('should fail when caller is not DolomiteMargin', async () => {
            await (0, assertions_1.expectThrow)(trader.connect(core.hhUser1).exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`);
        });
        it('should fail when output is insufficient', async () => {
            const { calldata: tradeData, outputAmount } = await (0, liquidation_utils_1.getCalldataForParaswap)(amountIn, core.tokens.weth, 18, minAmountOut, core.tokens.usdc, 6, core.hhUser1, trader, core);
            const actualOrderData = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [outputAmount.mul(10), tradeData]);
            await (0, assertions_1.expectThrowWithMatchingReason)(core.dolomiteMargin.connect(core.hhUser1).operate([{ owner: core.hhUser1.address, number: defaultAccountNumber }], [
                {
                    actionType: src_1.ActionType.Sell,
                    primaryMarketId: core.marketIds.weth,
                    secondaryMarketId: core.marketIds.usdc,
                    accountId: 0,
                    otherAccountId: 0,
                    amount: {
                        sign: false,
                        denomination: src_1.AmountDenomination.Wei,
                        ref: src_1.AmountReference.Delta,
                        value: amountIn,
                    },
                    otherAddress: trader.address,
                    data: actualOrderData,
                },
            ]), /ParaswapAggregatorTrader: Insufficient output amount <\d+, \d+>/);
        });
        it('should fail when calldata is invalid', async () => {
            const caller = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            const { calldata } = await (0, liquidation_utils_1.getCalldataForParaswap)(amountIn, core.tokens.weth, 18, minAmountOut, core.tokens.usdc, 6, core.dolomiteMargin, trader, core);
            const actualCalldata = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [
                minAmountOut,
                calldata.replace(core.tokens.weth.address.toLowerCase().substring(2), core.tokens.weth.address.toLowerCase().substring(2).replace('4', '3')),
            ]);
            await (0, assertions_1.expectThrow)(trader.connect(caller)
                .exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, amountIn, actualCalldata), 'ParaswapAggregatorTrader: Address: call to non-contract');
        });
        it('should fail when Paraswap fails', async () => {
            const caller = await (0, utils_1.impersonate)(core.dolomiteMargin.address, true);
            const { calldata } = await (0, liquidation_utils_1.getCalldataForParaswap)(amountIn, core.tokens.weth, 18, minAmountOut, core.tokens.usdc, 6, core.dolomiteMargin, trader, core);
            const actualCalldata = ethers_1.ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, calldata.substring(0, 32)]);
            await (0, assertions_1.expectThrow)(trader.connect(caller)
                .exchange(core.hhUser1.address, core.dolomiteMargin.address, core.tokens.weth.address, core.tokens.usdc.address, amountIn, actualCalldata), 'ParaswapAggregatorTrader: revert');
        });
    });
    describe('#getExchangeCost', () => {
        it('should always fail', async () => {
            await (0, assertions_1.expectThrow)(trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, no_deps_constants_1.ZERO_BI, no_deps_constants_1.BYTES_EMPTY), 'ParaswapAggregatorTrader: getExchangeCost not implemented');
        });
    });
});

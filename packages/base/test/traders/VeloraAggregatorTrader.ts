import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ParaswapAggregatorTraderV2, VeloraAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import {
  encodeExternalSellActionData,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectThrowWithMatchingReason,
} from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createParaswapAggregatorTraderV2, createVeloraAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForParaswap, getCalldataForVelora, ParaswapSwapType, swapTypeToSelector, VeloraSwapType, veloraSwapTypeToSelector } from '../utils/trader-utils';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('VeloraAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: VeloraAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    trader = (await createVeloraAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);

    await setupWETHBalance(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.VELORA_AUGUSTUS_SWAPPER()).to.equal(core.paraswapEcosystem!.augustusSwapper.address);
    });
  });

  describe('#exchange', () => {
    it('should succeed for swapExactAmountIn', async () => {
      const swapType = VeloraSwapType.SwapExactAmountIn;
      const { calldata } = await getCalldataForVelora(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it('should succeed for swapExactAmountInOnBalancerV2', async () => {
      const swapType = VeloraSwapType.SwapExactAmountInOnBalancerV2;
      const { calldata } = await getCalldataForVelora(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.nativeUsdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    xit('should succeed for swapExactAmountInOnCurveV1', async () => {
      const swapType = VeloraSwapType.SwapExactAmountInOnCurveV1;
      const { calldata } = await getCalldataForVelora(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.nativeUsdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it.only('should succeed for swapExactAmountInOnUniswapV2', async () => {
      const swapType = VeloraSwapType.SwapExactAmountInOnUniswapV2;
      const { calldata } = await getCalldataForVelora(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it('should succeed for mega swap when inputAmount is different', async () => {
      const swapType = ParaswapSwapType.Mega;
      const { calldata } = await getCalldataForParaswap(
        amountIn.mul(9).div(10),
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it('should succeed for multi swap when inputAmount is different', async () => {
      const swapType = ParaswapSwapType.Multi;
      const { calldata } = await getCalldataForParaswap(
        amountIn.mul(9).div(10),
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it('should succeed for simple swap when inputAmount is different', async () => {
      const swapType = ParaswapSwapType.Simple;
      const { calldata } = await getCalldataForParaswap(
        amountIn.mul(9).div(10),
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
        [swapType],
      );

      await doSwapAndCheckResults(calldata, swapType);
    });

    it('should fail when caller is not DolomiteMargin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.usdc.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when output is insufficient', async () => {
      const { calldata: tradeData, outputAmount } = await getCalldataForParaswap(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.hhUser1,
        trader,
        core,
      );
      const actualOrderData = encodeExternalSellActionData(
        outputAmount.mul(10000),
        ['bytes4', 'bytes'],
        [`0x${tradeData.slice(2, 10)}`, `0x${tradeData.slice(10)}`],
      );
      await expectThrowWithMatchingReason(
        core.dolomiteMargin.connect(core.hhUser1).operate(
          [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
          [
            {
              actionType: ActionType.Sell,
              primaryMarketId: core.marketIds.weth,
              secondaryMarketId: core.marketIds.usdc,
              accountId: 0,
              otherAccountId: 0,
              amount: {
                sign: false,
                denomination: AmountDenomination.Wei,
                ref: AmountReference.Delta,
                value: amountIn,
              },
              otherAddress: trader.address,
              data: actualOrderData,
            },
          ],
        ),
        /ParaswapAggregatorTraderV2: Insufficient output amount <\d+, \d+>/,
      );
    });

    it('should fail when function selector is invalid', async () => {
      const caller = await impersonate(core.dolomiteMargin.address, true);
      const { calldata } = await getCalldataForParaswap(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
      );
      const actualOrderData = encodeExternalSellActionData(
        minAmountOut,
        ['bytes4', 'bytes'],
        ['0x12345678', `0x${calldata.slice(10)}`],
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.weth.address,
            core.tokens.usdc.address,
            amountIn,
            actualOrderData,
          ),
        'ParaswapAggregatorTraderV2: Invalid Paraswap function selector <0x12345678>',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'ParaswapAggregatorTraderV2: getExchangeCost not implemented',
      );
    });
  });

  async function doSwapAndCheckResults(
    calldata: string,
    swapType: VeloraSwapType,
  ) {
    const actualOrderData = encodeExternalSellActionData(
      minAmountOut,
      ['bytes4', 'bytes'],
      [veloraSwapTypeToSelector(swapType), `0x${calldata.slice(10)}`],
    );
    await core.dolomiteMargin.connect(core.hhUser1).operate(
      [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
      [
        {
          actionType: ActionType.Sell,
          primaryMarketId: core.marketIds.weth,
          secondaryMarketId: core.marketIds.usdc,
          accountId: 0,
          otherAccountId: 0,
          amount: { sign: false, denomination: AmountDenomination.Wei, ref: AmountReference.Delta, value: amountIn },
          otherAddress: trader.address,
          data: actualOrderData,
        },
      ],
    );
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

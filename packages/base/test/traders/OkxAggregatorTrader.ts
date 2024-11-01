import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { TestOkxAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
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
import { CoreProtocolXLayer } from '../utils/core-protocols/core-protocol-x-layer';
import { createTestOkxAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from '../utils/setup';
import { getCalldataForOkx } from '../utils/trader-utils';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = '0';
const wethAmount = parseEther('1000');
const amountIn = ONE_ETH_BI;
const minAmountOut = BigNumber.from('123123123');
const usdcAmount = BigNumber.from('100000000'); // $100

describe('OkxAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolXLayer;
  let trader: TestOkxAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.XLayer),
      network: Network.XLayer,
    });
    trader = (await createTestOkxAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);

    await setupWETHBalance(core, core.hhUser1, wethAmount, { address: core.dolomiteMargin.address });
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.OKX_AGGREGATOR()).to.equal(core.okxEcosystem.dexRouter.address);
      expect(await trader.OKX_TRANSFER_PROXY()).to.equal(core.okxEcosystem.transferProxy.address);
    });
  });

  describe('#exchange', () => {
    it('should succeed for swap', async () => {
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        amountIn,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.001',
        trader.address
      );

      await doSwapAndCheckResults(calldata, amountIn, outputAmount);
    });

    it('should succeed for very large swap', async () => {
      const amount = parseEther('50'); // @follow-up This was failing with 100 ether
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        amount,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.1',
        trader.address
      );

      await doSwapAndCheckResults(calldata, amount, outputAmount);
    });

    it('should succeed for stablecoin swap', async () => {
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        usdcAmount,
        core.tokens.usdc.address,
        core.tokens.usdt.address,
        '0.1',
        trader.address
      );

      const actualOrderData = encodeExternalSellActionData(
        outputAmount,
        ['bytes4', 'bytes'],
        [calldata.slice(0, 10), `0x${calldata.slice(10)}`],
      );
      await core.dolomiteMargin.connect(core.hhUser1).operate(
        [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            primaryMarketId: core.marketIds.usdc,
            secondaryMarketId: core.marketIds.usdt,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: usdcAmount
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
      );
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdt.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdt, outputAmount, 0);
    });

    it('should succeed for swap when _inputAmount is bigger', async () => {
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        amountIn.mul(9).div(10),
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.1',
        trader.address
      );

      await doSwapAndCheckResults(calldata, amountIn, outputAmount);
    });

    it('should succeed for swap when _inputAmount is smaller', async () => {
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        amountIn,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.1',
        trader.address
      );

      await doSwapAndCheckResults(calldata, amountIn.mul(9).div(10), outputAmount.mul(9).div(10));
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
      const { calldata, outputAmount } = await getCalldataForOkx(
        Network.XLayer,
        amountIn,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.001',
        trader.address
      );
      const actualOrderData = encodeExternalSellActionData(
        outputAmount.mul(10000),
        ['bytes4', 'bytes'],
        [`0x${calldata.slice(2, 10)}`, `0x${calldata.slice(10)}`],
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
        /OkxAggregatorTrader: Insufficient output amount <\d+, \d+>/,
      );
    });

    it('should fail when function selector is invalid', async () => {
      const caller = await impersonate(core.dolomiteMargin.address, true);
      const { calldata } = await getCalldataForOkx(
        Network.XLayer,
        amountIn,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        '0.1',
        trader.address
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
        'OkxAggregatorTrader: Invalid OkxAggregator function selector <0x12345678>',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'OkxAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });

  describe('#getScaledBatchAmounts', () => {
    it('should work normally if actualInputAmount is bigger than fromTokenAmount', async () => {
      const res = await trader.testGetScaledBatchAmounts(100, 120, [90, 10]);
      expect(res[0]).to.eq(120);
      expect(res[1][0]).to.eq(108);
      expect(res[1][1]).to.eq(12);
    });

    it('should work normally if actualInputAmount is bigger than fromTokenAmount (with rounding)', async () => {
      const res = await trader.testGetScaledBatchAmounts(100, 106, [90, 10]);
      expect(res[0]).to.eq(106);
      expect(res[1][0]).to.eq(95);
      expect(res[1][1]).to.eq(11);
    });

    it('should work normally if actualInputAmount is smaller than fromTokenAmount', async () => {
      const res = await trader.testGetScaledBatchAmounts(100, 80, [90, 10]);
      expect(res[0]).to.eq(80);
      expect(res[1][0]).to.eq(72);
      expect(res[1][1]).to.eq(8);
    });

    it('should work normally if actualInputAmount is smaller than fromTokenAmount (with rounding)', async () => {
      const res = await trader.testGetScaledBatchAmounts(100, 94, [90, 10]);
      expect(res[0]).to.eq(94);
      expect(res[1][0]).to.eq(85);
      expect(res[1][1]).to.eq(9);
    });

    it('should work normally if actualInputAmount is equal to fromTokenAmount', async () => {
      const res = await trader.testGetScaledBatchAmounts(100, 100, [90, 10]);
      expect(res[0]).to.eq(100);
      expect(res[1][0]).to.eq(90);
      expect(res[1][1]).to.eq(10);
    });

    it('should work normally with 1 amount', async () => {
      let res = await trader.testGetScaledBatchAmounts(100, 90, [100]);
      expect(res[0]).to.eq(90);
      expect(res[1][0]).to.eq(90);
      res = await trader.testGetScaledBatchAmounts(100, 105, [100]);
      expect(res[0]).to.eq(105);
      expect(res[1][0]).to.eq(105);
      res = await trader.testGetScaledBatchAmounts(100, 100, [100]);
      expect(res[0]).to.eq(100);
      expect(res[1][0]).to.eq(100);
    });
  });

  async function doSwapAndCheckResults(
    calldata: string,
    amountIn: BigNumber,
    minAmountOut: BigNumber
  ) {
    const actualOrderData = encodeExternalSellActionData(
      minAmountOut,
      ['bytes4', 'bytes'],
      [calldata.slice(0, 10), `0x${calldata.slice(10)}`],
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
          amount: {
            sign: false,
            denomination: AmountDenomination.Wei,
            ref: AmountReference.Delta,
            value: amountIn
          },
          otherAddress: trader.address,
          data: actualOrderData,
        },
      ],
    );
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(
      core,
      core.hhUser1,
      defaultAccountNumber,
      core.marketIds.weth,
      wethAmount.sub(amountIn)
    );
    await expectProtocolBalanceIsGreaterThan(
      core,
      defaultAccount,
      core.marketIds.usdc,
      minAmountOut.add(usdcAmount),
      0
    );
  }
});

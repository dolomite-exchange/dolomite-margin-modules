import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { OdosAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalanceDustyOrZero, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createOdosAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForOdos } from '../utils/trader-utils';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('OdosAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: OdosAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    trader = (await createOdosAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);

    await setupWETHBalance(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: core.hhUser1.address, number: defaultAccountNumber },
      core.marketIds.weth,
      amountIn.sub(1),
      0,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.ODOS_ROUTER()).to.equal(core.odosEcosystem!.odosRouter.address);
    });
  });

  describe('#exchange', () => {
    it('should succeed for normal swap', async () => {
      const { calldata } = await getCalldataForOdos(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        trader,
        core,
      );

      await doSwapAndCheckResults(calldata);
    });

    it('should succeed for normal swap when inputAmount is higher', async () => {
      const inputAmount = amountIn.div(2);
      const { calldata, outputAmount } = await getCalldataForOdos(
        inputAmount,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        trader,
        core,
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          outputAmount,
          calldata,
        ],
      );
      const newInputAmount = inputAmount.mul(11).div(10);
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
              value: inputAmount.mul(11).div(10),
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
        { gasLimit: 10000000 },
      );
      expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalanceDustyOrZero(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth);
      await expectProtocolBalanceIsGreaterThan(
        core,
        defaultAccount,
        core.marketIds.weth,
        amountIn.sub(newInputAmount).sub(1),
        0,
      );
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
    });

    it('should succeed for normal swap when inputAmount is lower but output is still sufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOdos(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        trader,
        core,
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          minAmountOut,
          calldata,
        ],
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
              value: amountIn.mul(99999).div(100000),
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
        { gasLimit: 10000000 },
      );
      expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
    });

    it('should fail for normal swap when inputAmount is lower and output is not sufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOdos(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        trader,
        core,
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          outputAmount,
          calldata,
        ],
      );
      await expectThrow(core.dolomiteMargin.connect(core.hhUser1).operate(
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
              value: amountIn.div(2),
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
      ),
      'Slippage Limit Exceeded',
      );
    });

    it('should fail when output is insufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOdos(
        amountIn,
        core.tokens.weth,
        18,
        minAmountOut,
        core.tokens.usdc,
        6,
        trader,
        core,
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          outputAmount.mul(2),
          calldata,
        ],
      );
      await expectThrow(
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
        'OdosAggregatorTrader: Output amount is insufficient',
      );
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
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'OdosAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });

  async function doSwapAndCheckResults(
    calldata: string,
  ) {
    const actualOrderData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        minAmountOut,
        calldata,
      ],
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
      { gasLimit: 10000000 },
    );
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalanceDustyOrZero(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

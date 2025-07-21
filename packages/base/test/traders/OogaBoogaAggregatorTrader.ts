import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { OogaBoogaAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceDustyOrZero,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
} from '../utils/assertions';

import { createOogaBoogaAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupWBERABalance } from '../utils/setup';
import { getCalldataForOogaBooga } from '../utils/trader-utils';
import { ethers } from 'hardhat';
import { ActionType, AmountDenomination, AmountReference } from '@dolomite-exchange/dolomite-margin';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');

describe('OogaBoogaAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let trader: OogaBoogaAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.Berachain),
      network: Network.Berachain,
    });

    trader = (await createOogaBoogaAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.wbera);

    await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.wbera, 0);
    await setupWBERABalance(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.wbera, amountIn);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.OOGA_BOOGA_ROUTER()).to.equal(core.oogaBoogaEcosystem.oogaBoogaRouter.address);
    });
  });

  describe('#exchange', () => {
    it('should succeed for normal swap', async () => {
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        core.tokens.wbera,
        amountIn,
        core.tokens.usdc,
        trader
      );

      await doSwapAndCheckResults(calldata, outputAmount);
    });

    it('should succeed for normal swap when inputAmount is higher', async () => {
      const inputAmount = amountIn.div(2);
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        core.tokens.wbera,
        inputAmount,
        core.tokens.usdc,
        trader
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
            primaryMarketId: core.marketIds.wbera,
            secondaryMarketId: core.marketIds.usdc,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: newInputAmount
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
        { gasLimit: 10000000 },
      );
      expect(await core.tokens.wbera.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        defaultAccount,
        core.marketIds.wbera,
        amountIn.sub(newInputAmount).sub(1),
        0,
      );
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, outputAmount, 0);
    });

    it('should succeed for normal swap when inputAmount is lower but output is still sufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        core.tokens.wbera,
        amountIn,
        core.tokens.usdc,
        trader
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          outputAmount,
          calldata,
        ],
      );
      await core.dolomiteMargin.connect(core.hhUser1).operate(
        [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            primaryMarketId: core.marketIds.wbera,
            secondaryMarketId: core.marketIds.usdc,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: amountIn.mul(99999).div(100000)
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
        { gasLimit: 10000000 },
      );
      expect(await core.tokens.wbera.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalanceDustyOrZero(core, core.hhUser1, defaultAccountNumber, core.marketIds.wbera);
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, outputAmount, 0);
    });

    it('should succeed for normal swap when inputAmount is lower and output is not sufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        core.tokens.wbera,
        amountIn,
        core.tokens.usdc,
        trader
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
            primaryMarketId: core.marketIds.wbera,
            secondaryMarketId: core.marketIds.usdc,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: amountIn.div(2)
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
        { gasLimit: 10000000 },
      )); // throws with error SlippageExceeded(uint256 amountOut, uint256 outputMin);
    });

    it('should fail when caller is not DolomiteMargin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.wbera.address,
          core.tokens.usdc.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when output is insufficient', async () => {
      const { calldata, outputAmount } = await getCalldataForOogaBooga(
        core.tokens.wbera,
        amountIn,
        core.tokens.usdc,
        trader
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
              primaryMarketId: core.marketIds.wbera,
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
          { gasLimit: 10000000 },
        ),
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.wbera.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'OogaBoogaAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });

  async function doSwapAndCheckResults(
    calldata: string,
    outputAmount: BigNumber
  ) {
    const actualOrderData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        outputAmount,
        calldata,
      ],
    );
    await core.dolomiteMargin.connect(core.hhUser1).operate(
      [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
      [
        {
          actionType: ActionType.Sell,
          primaryMarketId: core.marketIds.wbera,
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
    expect(await core.tokens.wbera.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wbera, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, outputAmount, 0);
  }
});

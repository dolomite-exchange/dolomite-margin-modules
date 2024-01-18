import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { OdosAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';
import { createOdosAggregatorTrader } from '../utils/ecosystem-token-utils/traders';
import { CoreProtocol, disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForOdos } from '../utils/trader-utils';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('OdosAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocol;
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
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);

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

    it('should succeed for normal swap when inputAmount is different', async () => {
      const { calldata } = await getCalldataForOdos(
        amountIn.mul(9).div(10),
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
        'Minimum greater than quote',
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
    );
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

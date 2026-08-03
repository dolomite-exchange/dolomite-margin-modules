import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { MatchaAggregatorTrader, MatchaAggregatorTrader__factory } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
} from '../utils/assertions';

import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForMatcha } from '../utils/trader-utils';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { CoreProtocolEthereum } from '../utils/core-protocols/core-protocol-ethereum';

const MATCHA_ALLOWANCE_HOLDER = '0x0000000000001fF3684f28c67538d4D072C22734';

const defaultAccountNumber = '0';
const wethStartAmount = parseEther('10');
const amountIn = ONE_ETH_BI;
const minAmountOut = BigNumber.from('123123123');

describe('MatchaAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;

  let trader: MatchaAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.Ethereum);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.Ethereum,
    });

    trader = await createContractWithAbi<MatchaAggregatorTrader>(
      MatchaAggregatorTrader__factory.abi,
      MatchaAggregatorTrader__factory.bytecode,
      [MATCHA_ALLOWANCE_HOLDER, core.dolomiteMargin.address]
    );
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);

    await setupWETHBalance(core, core.hhUser1, wethStartAmount, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethStartAmount);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethStartAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.MATCHA_ALLOWANCE_HOLDER()).to.equal(MATCHA_ALLOWANCE_HOLDER);
    });
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      const { calldata } = await getCalldataForMatcha(
        core.config.network,
        core.tokens.weth,
        amountIn,
        core.tokens.usdc,
        trader,
      );

      await doSwapAndCheckResults(calldata);
    });

    it('should work normally when inputAmount is different', async () => {
      const { calldata } = await getCalldataForMatcha(
        core.config.network,
        core.tokens.weth,
        amountIn.sub(parseEther('.001')),
        core.tokens.usdc,
        trader,
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
      const { calldata } = await getCalldataForMatcha(
        core.config.network,
        core.tokens.weth,
        amountIn,
        core.tokens.usdc,
        trader,
      );

      const actualOrderData = defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [BigNumber.from('8000000000'), calldata] // 8000 USDC min output amount
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
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'MatchaAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });

  async function doSwapAndCheckResults(
    calldata: string
  ) {
    const actualOrderData = defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [minAmountOut, calldata]
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
      { gasLimit: 3_000_000 }
    );
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(
      core,
      core.hhUser1,
      defaultAccountNumber,
      core.marketIds.weth,
      wethStartAmount.sub(amountIn)
    );
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

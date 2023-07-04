import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { ParaswapAggregatorTrader } from '../../../src/types';
import { AccountStruct } from '../../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectThrowWithMatchingReason,
} from '../../utils/assertions';
import { createParaswapAggregatorTrader } from '../../utils/ecosystem-token-utils/traders';
import { getCalldataForParaswap } from '../../utils/liquidation-utils';
import { CoreProtocol, disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../../utils/setup';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('ParaswapAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let trader: ParaswapAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    trader = (await createParaswapAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);

    await setupWETHBalance(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.PARASWAP_AUGUSTUS_ROUTER()).to.equal(core.paraswapEcosystem!.augustusRouter);
      expect(await trader.PARASWAP_TRANSFER_PROXY()).to.equal(core.paraswapEcosystem!.transferProxy);
    });
  });

  describe('#exchange', () => {
    it('should succeed under normal conditions', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);

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
      const actualCalldata = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [minAmountOut, calldata],
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
            data: actualCalldata,
          },
        ],
      );

      expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
      expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
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
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [outputAmount.mul(10), tradeData],
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
        /ParaswapAggregatorTrader: Insufficient output amount <\d+, \d+>/,
      );
    });

    it('should fail when calldata is invalid', async () => {
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
      const actualCalldata = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          minAmountOut,
          calldata.replace(
            core.tokens.weth.address.toLowerCase().substring(2),
            core.tokens.weth.address.toLowerCase().substring(2).replace('4', '3'),
          ),
        ],
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.weth.address,
            core.tokens.usdc.address,
            amountIn,
            actualCalldata,
          ),
        'ParaswapAggregatorTrader: Address: call to non-contract',
      );
    });

    it('should fail when Paraswap fails', async () => {
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
      const actualCalldata = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [minAmountOut, calldata.substring(0, 32)],
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.weth.address,
            core.tokens.usdc.address,
            amountIn,
            actualCalldata,
          ),
        'ParaswapAggregatorTrader: revert',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'ParaswapAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });
});

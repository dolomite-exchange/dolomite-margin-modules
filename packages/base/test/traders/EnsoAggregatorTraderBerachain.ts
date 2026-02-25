import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { EnsoAggregatorTrader, EnsoAggregatorTrader__factory } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { getEnsoAggregatorTraderConstructorParams } from '../../src/utils/constructors/traders';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForEnso } from '../utils/trader-utils';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';

const defaultAccountNumber = '0';
const amountIn = ONE_ETH_BI;
const minAmountOut = BigNumber.from('1500000000'); // 1500 USDC

const ENSO_ROUTER_ADDRESS = '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf';
const ENSO_SHORTCUTS = '0x4Fe93ebC4Ce6Ae4f81601cC7Ce7139023919E003';
const ENSO_SWAP_HELPERS = '0xbedFAC7488DCcAAFdD66d1D7D56349780Fe0477e';

describe('EnsoAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let trader: EnsoAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.Berachain);
    core = await setupCoreProtocol({
      // blockNumber: latestBlockNumber,
      blockNumber: 16_827_800,
      network: Network.Berachain,
    });
    trader = await createContractWithAbi<EnsoAggregatorTrader>(
      EnsoAggregatorTrader__factory.abi,
      EnsoAggregatorTrader__factory.bytecode,
      getEnsoAggregatorTraderConstructorParams(core),
    );
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);

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
      expect(await trader.ENSO_ROUTER()).to.equal(ENSO_ROUTER_ADDRESS);
    });
  });

  describe('#exchange', () => {
    it('should succeed for normal swap', async () => {
      const { calldata } = await getCalldataForEnso(core, amountIn, core.tokens.weth, core.tokens.usdc, trader);

      await doSwapAndCheckResults(calldata);
    });

    it('should succeed for normal swap when actual input amount is larger', async () => {
      const { calldata } = await getCalldataForEnso(
        core,
        amountIn.mul(95).div(100),
        core.tokens.weth,
        core.tokens.usdc,
        trader,
      );

      await doSwapAndCheckResults(calldata);
    });

    it('should succeed for normal swap when actual input amount is smaller', async () => {
      const { calldata } = await getCalldataForEnso(
        core,
        amountIn.mul(10001).div(10000),
        core.tokens.weth,
        core.tokens.usdc,
        trader,
      );

      await doSwapAndCheckResults(calldata);
    });

    it('should fail if scaled output amount is insufficient', async () => {
      const { calldata } = await getCalldataForEnso(core, amountIn, core.tokens.weth, core.tokens.usdc, trader);

      const [indices, originalInputAmount, tradeData] = defaultAbiCoder.decode(
        ['uint256[]', 'uint256', 'bytes'],
        calldata,
      );
      const newCalldata = defaultAbiCoder.encode(
        ['uint256[]', 'uint256', 'bytes'],
        [indices, originalInputAmount.div(10), tradeData],
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
              data: defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, newCalldata]),
            },
          ],
        ),
        'EnsoAggregatorTrader: Insufficient output amount',
      );
    });

    it('should fail if pointer is out of bounds', async () => {
      const { calldata } = await getCalldataForEnso(core, amountIn, core.tokens.weth, core.tokens.usdc, trader);

      const [, originalInputAmount, tradeData] = defaultAbiCoder.decode(
        ['uint256[]', 'uint256', 'bytes'],
        calldata,
      );
      const newCalldata = defaultAbiCoder.encode(
        ['uint256[]', 'uint256', 'bytes'],
        [[tradeData.length + 100], originalInputAmount, tradeData],
      );

      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        trader
          .connect(doloImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.weth.address,
            core.tokens.usdc.address,
            amountIn,
            defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, newCalldata]),
          ),
        'EnsoAggregatorTrader: Pointer is out of bounds',
      );
    });

    it('should fail when caller is not DolomiteMargin', async () => {
      await expectThrow(
        trader
          .connect(core.hhUser1)
          .exchange(
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
      const { calldata, outputAmount } = await getCalldataForEnso(
        core,
        amountIn,
        core.tokens.weth,
        core.tokens.usdc,
        trader,
      );
      const actualOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [outputAmount.mul(2), calldata],
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
        // 'EnsoAggregatorTrader: Insufficient output amount',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'EnsoAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });

  async function doSwapAndCheckResults(calldata: string) {
    const actualOrderData = ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minAmountOut, calldata]);
    const ensoShortcutPreWethBal = await core.tokens.weth.balanceOf(ENSO_SHORTCUTS);
    const ensoShortcutPreUsdcBal = await core.tokens.usdc.balanceOf(ENSO_SHORTCUTS);
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
    expect(await core.tokens.weth.balanceOf(ENSO_SHORTCUTS)).to.eq(ensoShortcutPreWethBal);
    expect(await core.tokens.usdc.balanceOf(ENSO_SHORTCUTS)).to.eq(ensoShortcutPreUsdcBal);
    expect(await core.tokens.weth.balanceOf(ENSO_SWAP_HELPERS)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(ENSO_SWAP_HELPERS)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

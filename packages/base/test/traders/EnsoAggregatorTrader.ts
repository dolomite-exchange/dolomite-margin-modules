import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { EnsoAggregatorTrader, EnsoAggregatorTrader__factory, OdosAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createOdosAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForEnso, getCalldataForOdos } from '../utils/trader-utils';
import { CoreProtocolEthereum } from '../utils/core-protocols/core-protocol-ethereum';
import { hrtime } from 'process';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

const ENSO_ROUTER_ADDRESS = '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf';
const ENSO_SHORTCUTS = '0x4Fe93ebC4Ce6Ae4f81601cC7Ce7139023919E003';
const ENSO_SWAP_HELPERS = '0xbedFAC7488DCcAAFdD66d1D7D56349780Fe0477e';

describe('EnsoAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let trader: EnsoAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.Ethereum);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.Ethereum,
    });
    trader = await createContractWithAbi<EnsoAggregatorTrader>(
      EnsoAggregatorTrader__factory.abi,
      EnsoAggregatorTrader__factory.bytecode,
      [
        ENSO_ROUTER_ADDRESS,
        core.dolomiteMargin.address,
      ],
    )
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
      const { calldata } = await getCalldataForEnso(
        core,
        amountIn,
        core.tokens.weth,
        core.tokens.usdc,
        trader,
      );

      await doSwapAndCheckResults(calldata);
    });

    it.only('should succeed for normal swap when actual input amount is larger', async () => {
      const { calldata } = await getCalldataForEnso(
        core,
        amountIn.mul(95).div(100),
        core.tokens.weth,
        core.tokens.usdc,
        trader,
      );

      console.log(await core.tokens.weth.balanceOf(ENSO_SHORTCUTS));
      console.log(await core.tokens.weth.balanceOf(ENSO_SWAP_HELPERS));
      await doSwapAndCheckResults(calldata);
      console.log(await core.tokens.weth.balanceOf(ENSO_SHORTCUTS));
      console.log(await core.tokens.weth.balanceOf(ENSO_SWAP_HELPERS));
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
    hre.tracer.enabled = true;
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
    hre.tracer.enabled = false;
    expect(await core.tokens.weth.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.usdc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(core, defaultAccount, core.marketIds.usdc, minAmountOut, 0);
  }
});

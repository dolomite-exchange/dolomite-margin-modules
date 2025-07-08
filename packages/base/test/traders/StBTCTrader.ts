import { StBTCTrader, StBTCTrader__factory } from 'packages/base/src/types';
import { CoreProtocolBotanix } from '../utils/core-protocols/core-protocol-botanix';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { disableInterestAccrual, setupCoreProtocol, setupPBTCBalance } from '../utils/setup';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { expect } from 'chai';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from 'ethers';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src/types';
import { ActionType } from '@dolomite-margin/dist/src';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

const pBtcAmount = parseEther('100');
const defaultAccountNumber = ZERO_BI;

describe('StBTCTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBotanix;
  let trader: StBTCTrader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 739_800,
      network: Network.Botanix,
    });

    trader = await createContractWithAbi<StBTCTrader>(
      StBTCTrader__factory.abi,
      StBTCTrader__factory.bytecode,
      [core.tokens.pbtc.address, core.tokens.stBtc.address, core.dolomiteMargin.address]
    );

    await disableInterestAccrual(core, core.marketIds.pbtc);
    await disableInterestAccrual(core, core.marketIds.stBtc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should work normally', async () => {
      expect(await trader.PBTC()).to.equal(core.tokens.pbtc.address);
      expect(await trader.STBTC()).to.equal(core.tokens.stBtc.address);
    });
  });

  describe('#exchange', () => {
    it('should work normally for pBTC -> stBTC', async () => {
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);

      await doSwapAndCheckResults(
        core.marketIds.pbtc,
        pBtcAmount,
        core.marketIds.stBtc,
        ONE_BI
      );
    });

    it('should work normally for stBTC -> pBTC', async () => {
      // swap from pBTC to stBTC
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);
      await doSwapAndCheckResults(
        core.marketIds.pbtc,
        pBtcAmount,
        core.marketIds.stBtc,
        ONE_BI
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.stBtc, pBtcAmount);

      // swap from stBTC to pBTC
      await doSwapAndCheckResults(
        core.marketIds.stBtc,
        pBtcAmount,
        core.marketIds.pbtc,
        ONE_BI
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);
    });

    it('should fail if output amount is insufficient', async () => {
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);

      const actualOrderData = defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          pBtcAmount.add(ONE_BI),
          BYTES_EMPTY
        ],
      );
      await expectThrow(core.dolomiteMargin.connect(core.hhUser1).operate(
        [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
        [
          {
            actionType: ActionType.Sell,
            primaryMarketId: core.marketIds.pbtc,
            secondaryMarketId: core.marketIds.stBtc,
            accountId: 0,
            otherAccountId: 0,
            amount: {
              sign: false,
              denomination: AmountDenomination.Wei,
              ref: AmountReference.Delta,
              value: pBtcAmount
            },
            otherAddress: trader.address,
            data: actualOrderData,
          },
        ],
      ),
        `StBTCTrader: Insufficient output amount <${pBtcAmount.toString()}, ${pBtcAmount.add(ONE_BI).toString()}>`
      );
    });

    it('should fail for invalid swap', async () => {
      const dolomiteImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(trader.connect(dolomiteImpersonator).exchange(
        core.hhUser1.address,
        core.hhUser1.address,
        core.tokens.weth.address,
        core.tokens.pbtc.address,
        pBtcAmount,
        BYTES_EMPTY
      ),
        'StBTCTrader: Invalid trade'
      );
      await expectThrow(trader.connect(dolomiteImpersonator).exchange(
        core.hhUser1.address,
        core.hhUser1.address,
        core.tokens.stBtc.address,
        core.tokens.weth.address,
        pBtcAmount,
        BYTES_EMPTY
      ),
        'StBTCTrader: Invalid trade'
      );
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.hhUser1.address,
          core.tokens.pbtc.address,
          core.tokens.stBtc.address,
          pBtcAmount,
          BYTES_EMPTY
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally for pBTC -> stBTC', async () => {
      expect(await trader.getExchangeCost(
        core.tokens.pbtc.address,
        core.tokens.stBtc.address,
        pBtcAmount,
        BYTES_EMPTY
      )).to.eq(pBtcAmount);
    });

    it('should work normally for stBTC -> pBTC', async () => {
      expect(await trader.getExchangeCost(
        core.tokens.stBtc.address,
        core.tokens.pbtc.address,
        pBtcAmount,
        BYTES_EMPTY
      )).to.eq(pBtcAmount);
    });

    it('should fail for invalid trade', async () => {
      await expectThrow(trader.getExchangeCost(
        core.tokens.weth.address,
        core.tokens.pbtc.address,
        pBtcAmount,
        BYTES_EMPTY
      ),
        'StBTCTrader: Invalid trade'
      );
    });
  });

  async function doSwapAndCheckResults(
    inputMarketId: BigNumberish,
    inputAmount: BigNumber,
    outputMarketId: BigNumberish,
    minOutputAmount: BigNumber
  ) {
    const actualOrderData = defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        minOutputAmount,
        BYTES_EMPTY
      ],
    );
    await core.dolomiteMargin.connect(core.hhUser1).operate(
      [{ owner: core.hhUser1.address, number: defaultAccountNumber }],
      [
        {
          actionType: ActionType.Sell,
          primaryMarketId: inputMarketId,
          secondaryMarketId: outputMarketId,
          accountId: 0,
          otherAccountId: 0,
          amount: { sign: false, denomination: AmountDenomination.Wei, ref: AmountReference.Delta, value: inputAmount },
          otherAddress: trader.address,
          data: actualOrderData,
        },
      ],
    );
    expect(await core.tokens.pbtc.balanceOf(trader.address)).to.eq(ZERO_BI);
    expect(await core.tokens.stBtc.balanceOf(trader.address)).to.eq(ZERO_BI);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, inputMarketId, ZERO_BI);
    await expectProtocolBalanceIsGreaterThan(
      core,
      { owner: core.hhUser1.address, number: defaultAccountNumber },
      outputMarketId,
      minOutputAmount,
      0
    );
  }
});

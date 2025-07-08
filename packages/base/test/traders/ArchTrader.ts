import { ArchTrader, ArchTrader__factory } from 'packages/base/src/types';
import { CoreProtocolBotanix } from '../utils/core-protocols/core-protocol-botanix';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { disableInterestAccrual, setupCoreProtocol, setupPBTCBalance } from '../utils/setup';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { expect } from 'chai';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from 'ethers';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src/types';
import { ActionType } from '@dolomite-margin/dist/src';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow, expectWalletBalance } from '../utils/assertions';
import { ethers } from 'hardhat';

const pBtcAmount = parseEther('.0001');
const defaultAccountNumber = ZERO_BI;

const ARCH_SWAP_ROUTER = '0x480E5DDD62637568d2515268f525b34F5387537D';
const ARCH_POOL_DEPLOYER = '';

describe('ArchTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBotanix;
  let trader: ArchTrader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 755_700,
      network: Network.Botanix,
    });

    trader = await createContractWithAbi<ArchTrader>(
      ArchTrader__factory.abi,
      ArchTrader__factory.bytecode,
      [ARCH_SWAP_ROUTER, core.dolomiteMargin.address]
    );

    await disableInterestAccrual(core, core.marketIds.pbtc);
    await disableInterestAccrual(core, core.marketIds.stBtc);
    await disableInterestAccrual(core, core.marketIds.usdc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should work normally', async () => {
      expect(await trader.ARCH_SWAP_ROUTER()).to.equal(ARCH_SWAP_ROUTER);
    });
  });

  describe('#exchange', () => {
    it('should work normally for exactInputSingle', async () => {
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);

      await doSwapAndCheckResults(
        core.marketIds.pbtc,
        pBtcAmount,
        core.marketIds.usdc,
        ONE_BI,
      );
    });

    it('should work normally for exactInput', async () => {
      // swap from pBTC to stBTC
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);
      await doSwapAndCheckResults(
        core.marketIds.pbtc,
        pBtcAmount,
        core.marketIds.stBtc,
        ONE_BI
      );
      const stBtcAmount = await core.dolomiteMargin.getAccountWei({ owner: core.hhUser1.address, number: defaultAccountNumber }, core.marketIds.stBtc);

      // swap from stBTC to USDC.e
      await doSwapAndCheckResults(
        core.marketIds.stBtc,
        stBtcAmount.value,
        core.marketIds.usdc,
        ONE_BI,
        ethers.utils.solidityPack(
          ['address', 'address', 'address', 'address', 'address'],
          [core.tokens.stBtc.address, ADDRESS_ZERO, core.tokens.pbtc.address, ADDRESS_ZERO, core.tokens.usdc.address]
        )
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.stBtc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.usdc,
        ONE_BI, ZERO_BI
      );
      await expectWalletBalance(trader, core.tokens.pbtc, ZERO_BI);
      await expectWalletBalance(trader, core.tokens.stBtc, ZERO_BI);
      await expectWalletBalance(trader, core.tokens.usdc, ZERO_BI);
    });

    it('should fail if output amount is insufficient', async () => {
      await setupPBTCBalance(core, core.hhUser1, pBtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.pbtc, pBtcAmount);

      const actualOrderData = defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          pBtcAmount,
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
        `ArchTrader: Insufficient output amount <99971703366770, ${pBtcAmount.toString()}>`
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
    // it('should work normally for pBTC -> stBTC', async () => {
    //   expect(await trader.getExchangeCost(
    //     core.tokens.pbtc.address,
    //     core.tokens.stBtc.address,
    //     pBtcAmount,
    //     BYTES_EMPTY
    //   )).to.eq(pBtcAmount);
    // });

    // it('should work normally for stBTC -> pBTC', async () => {
    //   expect(await trader.getExchangeCost(
    //     core.tokens.stBtc.address,
    //     core.tokens.pbtc.address,
    //     pBtcAmount,
    //     BYTES_EMPTY
    //   )).to.eq(pBtcAmount);
    // });

    // it('should fail for invalid trade', async () => {
    //   await expectThrow(trader.getExchangeCost(
    //     core.tokens.weth.address,
    //     core.tokens.pbtc.address,
    //     pBtcAmount,
    //     BYTES_EMPTY
    //   ),
    //     'StBTCTrader: Invalid trade'
    //   );
    // });
  });

  async function doSwapAndCheckResults(
    inputMarketId: BigNumberish,
    inputAmount: BigNumber,
    outputMarketId: BigNumberish,
    minOutputAmount: BigNumber,
    path: string = BYTES_EMPTY
  ) {
    const actualOrderData = defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        minOutputAmount,
        path
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
      { gasLimit: 10_000_000 }
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
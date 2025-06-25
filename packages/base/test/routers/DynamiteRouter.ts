import { MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupWETHBalance,
} from '../utils/setup';
import {
  DynamiteRouter,
  DynamiteRouter__factory,
} from 'packages/base/src/types';
import {
  createContractWithAbi,
} from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { BigNumber } from 'ethers';
import { expectEvent, expectProtocolBalance, expectWalletBalance } from '../utils/assertions';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';

enum EventFlag {
  None = 0,
  Borrow = 1,
}

const borrowAccountNumber = BigNumber.from('123');

const wethAmountWei = ONE_ETH_BI;
const daiAmountWei = parseEther('500');

describe('DynamiteRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: DynamiteRouter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_570_000,
    });
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);

    router = await createContractWithAbi<DynamiteRouter>(
      DynamiteRouter__factory.abi,
      DynamiteRouter__factory.bytecode,
      [core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(router.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await router.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#depositAndBorrowWei', () => {
    it('should work normally', async () => {
      await setupWETHBalance(core, core.hhUser1, wethAmountWei, router);
      const res = await router.depositAndBorrowWei(
        borrowAccountNumber,
        core.marketIds.weth,
        core.marketIds.dai,
        wethAmountWei,
        daiAmountWei,
        EventFlag.Borrow
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        borrower: core.hhUser1.address,
        borrowAccountNumber: borrowAccountNumber.toString(),
      });

      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        ZERO_BI.sub(daiAmountWei)
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmountWei);
      await expectWalletBalance(core.hhUser1, core.tokens.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, daiAmountWei);
    });

    it('should not emit event if event flag is none', async () => {
      await setupWETHBalance(core, core.hhUser1, wethAmountWei, router);
      const res = await router.depositAndBorrowWei(
        borrowAccountNumber,
        core.marketIds.weth,
        core.marketIds.dai,
        wethAmountWei,
        daiAmountWei,
        EventFlag.None
      );
      await expect(res).to.not.emit(core.eventEmitterRegistry, 'BorrowPositionOpen');
    });
  });

  describe('#repayAndWithdrawWei', () => {
    it('should work normally', async () => {
      await setupWETHBalance(core, core.hhUser1, wethAmountWei, router);
      await router.depositAndBorrowWei(
        borrowAccountNumber,
        core.marketIds.weth,
        core.marketIds.dai,
        wethAmountWei,
        daiAmountWei,
        EventFlag.Borrow
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        ZERO_BI.sub(daiAmountWei)
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmountWei);

      await core.tokens.dai.connect(core.hhUser1).approve(router.address, daiAmountWei);
      await router.repayAndWithdrawWei(
        borrowAccountNumber,
        core.marketIds.dai,
        core.marketIds.weth,
        daiAmountWei.div(2),
        wethAmountWei.div(2)
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        ZERO_BI.sub(daiAmountWei.div(2))
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmountWei.div(2));
      await expectWalletBalance(core.hhUser1, core.tokens.weth, wethAmountWei.div(2));
      await expectWalletBalance(core.hhUser1, core.tokens.dai, daiAmountWei.div(2));
    });

    it('should work normally with max values', async () => {
      await setupWETHBalance(core, core.hhUser1, wethAmountWei, router);
      await router.depositAndBorrowWei(
        borrowAccountNumber,
        core.marketIds.weth,
        core.marketIds.dai,
        wethAmountWei,
        daiAmountWei,
        EventFlag.Borrow
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        ZERO_BI.sub(daiAmountWei)
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wethAmountWei);

      await core.tokens.dai.connect(core.hhUser1).approve(router.address, daiAmountWei);
      await router.repayAndWithdrawWei(
        borrowAccountNumber,
        core.marketIds.dai,
        core.marketIds.weth,
        MAX_UINT_256_BI,
        MAX_UINT_256_BI
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.weth, wethAmountWei);
    });
  });
});

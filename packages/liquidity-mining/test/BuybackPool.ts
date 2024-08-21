import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectEvent, expectThrow, expectWalletBalance } from 'packages/base/test/utils/assertions';
import { CustomTestToken } from 'packages/base/src/types';
import { createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { parseEther } from 'ethers/lib/utils';
import { BuybackPool } from '../src/types';
import { createBuybackPool } from './liquidity-mining-ecosystem-utils';

const tokenAmount = parseEther('1');

describe('BuybackPool', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let buybackPool: BuybackPool;
  let rewardToken: CustomTestToken;
  let paymentToken: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    rewardToken = await createTestToken();
    paymentToken = await createTestToken();

    buybackPool = await createBuybackPool(core, rewardToken, paymentToken);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      const rewardAmount = tokenAmount.div(20);
      await paymentToken.addBalance(core.hhUser1.address, tokenAmount);
      await rewardToken.addBalance(buybackPool.address, rewardAmount);

      await paymentToken.connect(core.hhUser1).approve(buybackPool.address, tokenAmount);
      await buybackPool.connect(core.hhUser1).exchange(tokenAmount);

      await expectWalletBalance(core.hhUser1, paymentToken, 0);
      await expectWalletBalance(buybackPool, paymentToken, tokenAmount);
      await expectWalletBalance(core.hhUser1, rewardToken, rewardAmount);
      await expectWalletBalance(buybackPool, rewardToken, 0);
    });

    it('should fail if pool does not have enough reward token', async () => {
      await paymentToken.addBalance(core.hhUser1.address, tokenAmount);

      await paymentToken.connect(core.hhUser1).approve(buybackPool.address, tokenAmount);
      await expectThrow(
        buybackPool.connect(core.hhUser1).exchange(tokenAmount),
        'ERC20: transfer amount exceeds balance'
      );
    });
  });

  describe('#ownerWithdrawpaymentToken', () => {
    it('should work normally', async () => {
      await paymentToken.addBalance(buybackPool.address, tokenAmount);
      await buybackPool.connect(core.governance).ownerWithdrawPaymentToken();
      expect(await paymentToken.balanceOf(buybackPool.address)).to.eq(0);
      expect(await paymentToken.balanceOf(core.governance.address)).to.eq(tokenAmount);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        buybackPool.connect(core.hhUser1).ownerWithdrawPaymentToken(),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetExchangeRate', () => {
    it('should work normally', async () => {
      expect(await buybackPool.exchangeRate()).to.eq(20);
      const res = await buybackPool.connect(core.governance).ownerSetExchangeRate(50);
      await expectEvent(buybackPool, res, 'ExchangeRateSet',
        { exchangeRate: 50 }
      );
      expect(await buybackPool.exchangeRate()).to.eq(50);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        buybackPool.connect(core.hhUser1).ownerSetExchangeRate(1000),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

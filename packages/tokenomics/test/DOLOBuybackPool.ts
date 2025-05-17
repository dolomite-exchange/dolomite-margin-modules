import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectEvent, expectThrow, expectWalletBalance } from 'packages/base/test/utils/assertions';
import { CustomTestToken } from 'packages/base/src/types';
import { createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { parseEther } from 'ethers/lib/utils';
import { DOLOBuybackPool } from '../src/types';
import { createDOLOBuybackPool } from './tokenomics-ecosystem-utils';

const tokenAmount = parseEther('1');

describe('DOLOBuybackPool', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let buybackPool: DOLOBuybackPool;
  let dolo: CustomTestToken;
  let odolo: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createTestToken();
    odolo = await createTestToken();

    buybackPool = await createDOLOBuybackPool(core, dolo, odolo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      const rewardAmount = tokenAmount.div(20);
      await odolo.addBalance(core.hhUser1.address, tokenAmount);
      await dolo.addBalance(buybackPool.address, rewardAmount);

      await odolo.connect(core.hhUser1).approve(buybackPool.address, tokenAmount);
      await buybackPool.connect(core.hhUser1).exchange(tokenAmount);

      await expectWalletBalance(core.hhUser1, odolo, 0);
      await expectWalletBalance(buybackPool, odolo, tokenAmount);
      await expectWalletBalance(core.hhUser1, dolo, rewardAmount);
      await expectWalletBalance(buybackPool, dolo, 0);
    });

    it('should fail if pool does not have enough reward token', async () => {
      await odolo.addBalance(core.hhUser1.address, tokenAmount);

      await odolo.connect(core.hhUser1).approve(buybackPool.address, tokenAmount);
      await expectThrow(
        buybackPool.connect(core.hhUser1).exchange(tokenAmount),
        'ERC20: transfer amount exceeds balance'
      );
    });
  });

  describe('#ownerWithdrawpaymentToken', () => {
    it('should work normally', async () => {
      await odolo.addBalance(buybackPool.address, tokenAmount);
      await buybackPool.connect(core.governance).ownerWithdrawODolo(core.governance.address);
      expect(await odolo.balanceOf(buybackPool.address)).to.eq(0);
      expect(await odolo.balanceOf(core.governance.address)).to.eq(tokenAmount);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        buybackPool.connect(core.hhUser1).ownerWithdrawODolo(core.governance.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetExchangeRate', () => {
    it('should work normally', async () => {
      expect(await buybackPool.exchangeRate()).to.eq(parseEther('.05'));
      const res = await buybackPool.connect(core.governance).ownerSetExchangeRate(parseEther('.5'));
      await expectEvent(buybackPool, res, 'ExchangeRateSet',
        { exchangeRate: parseEther('.5') }
      );
      expect(await buybackPool.exchangeRate()).to.eq(parseEther('.5'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        buybackPool.connect(core.hhUser1).ownerSetExchangeRate(1000),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

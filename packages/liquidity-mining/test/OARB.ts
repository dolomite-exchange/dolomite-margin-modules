import { expect } from 'chai';
import { OARB } from '../src/types';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { createOARB } from './liquidity-mining-ecosystem-utils';

describe('OARB', () => {
  let snapshotId: string;
  let core: CoreProtocol;
  let oARB: OARB;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createOARB(core);
    await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oARB.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        oARB.connect(core.hhUser1).mint(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
      await oARB.connect(core.hhUser5).burn(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        oARB.connect(core.hhUser1).burn(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

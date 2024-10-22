import {
  Network,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { MineralToken } from '../src/types';
import { createMineralToken } from './liquidity-mining-ecosystem-utils';

const amount = '123';

describe('MineralToken', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let mineral: MineralToken;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    mineral = await createMineralToken(core);
    await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await mineral.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#initialize', () => {
    it('should fail if already called', async () => {
      await expectThrow(mineral.initialize());
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await mineral.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await mineral.connect(core.hhUser5).mint(amount);
      expect(await mineral.balanceOf(core.hhUser5.address)).to.eq(amount);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        mineral.connect(core.hhUser1).mint(amount),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      expect(await mineral.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await mineral.connect(core.hhUser5).mint(amount);
      expect(await mineral.balanceOf(core.hhUser5.address)).to.eq(amount);
      await mineral.connect(core.hhUser5).burn(amount);
      expect(await mineral.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        mineral.connect(core.hhUser1).burn(amount),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transfer', () => {
    it('should succeed if called by mineral claimer', async () => {
      await mineral.connect(core.hhUser5).mint(amount);
    });

    it('should fail if not called from mineral claimer', async () => {
      await mineral.connect(core.hhUser5).mint(amount);
      await mineral.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      await expectThrow(
        mineral.transfer(core.hhUser5.address, amount),
        `MineralToken: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

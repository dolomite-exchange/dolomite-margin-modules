import {
  Network,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
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

  describe('#ownerSetIsTransferAgent', () => {
    it('should work normally', async () => {
      expect(await mineral.isTransferAgent(core.hhUser5.address)).to.be.false;
      await mineral.connect(core.governance).ownerSetIsTransferAgent(core.hhUser5.address, true);
      expect(await mineral.isTransferAgent(core.hhUser5.address)).to.be.true;
    });

    it('should fail if called for an invalid address', async () => {
      await expectThrow(
        mineral.connect(core.governance).ownerSetIsTransferAgent(ADDRESS_ZERO, true),
        'MineralToken: Invalid transfer agent',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        mineral.connect(core.hhUser1).ownerSetIsTransferAgent(core.hhUser1.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

    it('should succeed if called by a transfer agent', async () => {
      await mineral.connect(core.hhUser5).mint(amount);
      await mineral.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      await mineral.connect(core.governance).ownerSetIsTransferAgent(core.hhUser1.address, true);
      await mineral.connect(core.hhUser1).transfer(core.hhUser5.address, amount);
    });

    it('should fail if not called from mineral claimer', async () => {
      await mineral.connect(core.hhUser5).mint(amount);
      await mineral.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      expect(await core.dolomiteMargin.getIsGlobalOperator(core.hhUser1.address)).to.be.false;
      expect(await mineral.isTransferAgent(core.hhUser1.address)).to.be.false;
      await expectThrow(
        mineral.connect(core.hhUser1).transfer(core.hhUser5.address, amount),
        `MineralToken: Transfer is not authorized <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

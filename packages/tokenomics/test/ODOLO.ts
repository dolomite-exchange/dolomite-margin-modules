import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { ODOLO } from '../src/types';
import { createODOLO } from './tokenomics-ecosystem-utils';

describe('ODOLO', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let oDolo: ODOLO;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oDolo = await createODOLO(core);
    await oDolo.connect(core.governance).ownerSetHandler(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oDolo.owner()).to.eq(core.governance.address);
      expect(await oDolo.name()).to.eq('oDOLO Token');
      expect(await oDolo.symbol()).to.eq('oDOLO');
    });
  });

  describe('#ownerSetHandler', () => {
    it('should work normally', async () => {
      expect(await oDolo.isHandler(core.hhUser5.address)).to.eq(true);
      const res = await oDolo.connect(core.governance).ownerSetHandler(core.hhUser5.address, false);
      await expectEvent(oDolo, res, 'HandlerSet', {
        handler: core.hhUser5.address,
        isTrusted: false,
      });
      expect(await oDolo.isHandler(core.hhUser5.address)).to.eq(false);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oDolo.connect(core.hhUser5).ownerSetHandler(core.hhUser5.address, true),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#ownerMint', () => {
    it('should work normally', async () => {
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oDolo.connect(core.governance).ownerMint(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.governance.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oDolo.connect(core.hhUser5).ownerMint(ONE_ETH_BI),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#ownerBurn', () => {
    it('should work normally', async () => {
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oDolo.connect(core.governance).ownerMint(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.governance.address)).to.eq(ONE_ETH_BI);
      await oDolo.connect(core.governance).ownerBurn(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.governance.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oDolo.connect(core.hhUser5).ownerBurn(ONE_ETH_BI),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oDolo.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        oDolo.connect(core.hhUser1).mint(ONE_ETH_BI),
        'oDOLO: Invalid handler',
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oDolo.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
      await oDolo.connect(core.hhUser5).burn(ONE_ETH_BI);
      expect(await oDolo.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        oDolo.connect(core.hhUser1).burn(ONE_ETH_BI),
        'oDOLO: Invalid handler',
      );
    });
  });
});

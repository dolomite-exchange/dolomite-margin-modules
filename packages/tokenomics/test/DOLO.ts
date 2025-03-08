import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { DOLO } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createDOLO } from './tokenomics-ecosystem-utils';

describe('DOLO', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core, core.hhUser5.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await dolo.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await dolo.owner()).to.eq(core.governance.address);
      expect(await dolo.getCCIPAdmin()).to.eq(ADDRESS_ZERO);
      expect(await dolo.totalSupply()).to.eq(parseEther('1000000000'));
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      await dolo.connect(core.governance).ownerSetMinter(core.hhUser5.address, true);
      await dolo.connect(core.hhUser5).mint(core.hhUser1.address, parseEther('100'));
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('100'));
    });

    it('should fail if not called by a minter', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).mint(core.hhUser1.address, parseEther('100')),
        'DOLO: Not a minter'
      );
    });

    it('should fail if account is dolo', async () => {
      await dolo.connect(core.governance).ownerSetMinter(core.hhUser5.address, true);
      await expectThrow(
        dolo.connect(core.hhUser5).mint(dolo.address, parseEther('100')),
        'DOLO: Invalid account'
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      const amount = parseEther('100');
      await dolo.connect(core.hhUser5).burn(amount);
      await expect(() => dolo.connect(core.hhUser5).burn(amount))
        .to.changeTokenBalance(dolo, core.hhUser5.address, ZERO_BI.sub(amount));
    });
  });

  describe('#burnFrom', () => {
    it('should work normally', async () => {
      const amount = parseEther('100');
      await dolo.connect(core.governance).ownerStart();
      await dolo.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      await dolo.connect(core.hhUser1).approve(core.hhUser5.address, amount);
      await expect(() => dolo.connect(core.hhUser5).burnFrom(core.hhUser1.address, amount))
        .to.changeTokenBalance(dolo, core.hhUser1.address, ZERO_BI.sub(amount));
    });
  });

  describe('#approve', () => {
    it('should fail if approving the dolo address', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).approve(dolo.address, ONE_BI),
        'DOLO: Invalid spender'
      );
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      await dolo.connect(core.governance).ownerStart();
      await dolo.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_BI);
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(ONE_BI);
    });

    it('should fail if not started', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).transfer(core.hhUser5.address, ONE_BI),
        'DOLO: Not started'
      );
    });

    it('should fail if transferring to the dolo address', async () => {
      await dolo.connect(core.governance).ownerStart();
      await expectThrow(
        dolo.connect(core.hhUser1).transfer(dolo.address, ONE_BI),
        'DOLO: Invalid recipient'
      );
    });
  });

  describe('#ownerSetCCIPAdmin', () => {
    it('should work normally', async () => {
      const res = await dolo.connect(core.governance).ownerSetCCIPAdmin(core.hhUser5.address);
      await expectEvent(dolo, res, 'CCIPAdminSet', {
        newAdmin: core.hhUser5.address
      });
      expect(await dolo.getCCIPAdmin()).to.eq(core.hhUser5.address);
    });

    it('should fail if address zero', async () => {
      await expectThrow(
        dolo.connect(core.governance).ownerSetCCIPAdmin(ADDRESS_ZERO),
        'DOLO: Invalid CCIP admin'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).ownerSetCCIPAdmin(core.hhUser5.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetMinter', () => {
    it('should work normally', async () => {
      expect(await dolo.isMinter(core.hhUser5.address)).to.be.false;
      const res = await dolo.connect(core.governance).ownerSetMinter(core.hhUser5.address, true);
      await expectEvent(dolo, res, 'MinterSet', {
        minter: core.hhUser5.address,
        isMinter: true
      });
      expect(await dolo.isMinter(core.hhUser5.address)).to.be.true;
    });

    it('should fail if address zero', async () => {
      await expectThrow(
        dolo.connect(core.governance).ownerSetMinter(ADDRESS_ZERO, true),
        'DOLO: Invalid minter'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).ownerSetMinter(core.hhUser5.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerStart', () => {
    it('should work normally', async () => {
      expect(await dolo.hasStarted()).to.be.false;
      const res = await dolo.connect(core.governance).ownerStart();
      await expectEvent(dolo, res, 'Started', {});
      expect(await dolo.hasStarted()).to.be.true;
    });

    it('should fail if already started', async () => {
      await dolo.connect(core.governance).ownerStart();
      await expectThrow(
        dolo.connect(core.governance).ownerStart(),
        'DOLO: Already started'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).ownerStart(),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

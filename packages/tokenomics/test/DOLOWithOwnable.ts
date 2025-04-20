import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { DOLOWithOwnable } from '../src/types';
import { createDOLOWithOwnable } from './tokenomics-ecosystem-utils';

describe('DOLOWithOwnable', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLOWithOwnable;

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLOWithOwnable(core.gnosisSafe.address);
    await dolo.connect(core.gnosisSafe).transfer(core.hhUser5.address, parseEther(`${1_000}`));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await dolo.owner()).to.eq(core.gnosisSafe.address);
      expect(await dolo.getCCIPAdmin()).to.eq(ADDRESS_ZERO);
      expect(await dolo.totalSupply()).to.eq(parseEther(`${1_000_000_000}`));
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      await dolo.connect(core.gnosisSafe).ownerSetMinter(core.gnosisSafe.address, true);
      await dolo.connect(core.gnosisSafe).mint(core.hhUser1.address, parseEther('100'));
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('100'));
    });

    it('should fail if not called by a minter', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).mint(core.hhUser1.address, parseEther('100')),
        'DOLOWithOwnable: Not a minter',
      );
    });

    it('should fail if account is dolo', async () => {
      await dolo.connect(core.gnosisSafe).ownerSetMinter(core.gnosisSafe.address, true);
      await expectThrow(
        dolo.connect(core.gnosisSafe).mint(dolo.address, parseEther('100')),
        'DOLOWithOwnable: Invalid account',
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      const amount = parseEther('100');
      await dolo.connect(core.hhUser5).burn(amount);
      await expect(() => dolo.connect(core.hhUser5).burn(amount)).to.changeTokenBalance(
        dolo,
        core.hhUser5.address,
        ZERO_BI.sub(amount),
      );
    });
  });

  describe('#burnFrom', () => {
    it('should work normally', async () => {
      const amount = parseEther('100');
      await dolo.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      await dolo.connect(core.hhUser1).approve(core.hhUser5.address, amount);
      await expect(() => dolo.connect(core.hhUser5).burnFrom(core.hhUser1.address, amount)).to.changeTokenBalance(
        dolo,
        core.hhUser1.address,
        ZERO_BI.sub(amount),
      );
    });
  });

  describe('#approve', () => {
    it('should fail if approving the dolo address', async () => {
      await expectThrow(dolo.connect(core.hhUser1).approve(dolo.address, ONE_BI), 'DOLOWithOwnable: Invalid spender');
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      await dolo.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_BI);
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(ONE_BI);
    });

    it('should fail if transferring to the dolo address', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).transfer(dolo.address, ONE_BI),
        'DOLOWithOwnable: Invalid recipient',
      );
    });
  });

  describe('#ownerSetCCIPAdmin', () => {
    it('should work normally', async () => {
      const res = await dolo.connect(core.gnosisSafe).ownerSetCCIPAdmin(core.hhUser5.address);
      await expectEvent(dolo, res, 'CCIPAdminSet', {
        ccipAdmin: core.hhUser5.address,
      });
      expect(await dolo.getCCIPAdmin()).to.eq(core.hhUser5.address);
    });

    it('should fail if address zero', async () => {
      await expectThrow(
        dolo.connect(core.gnosisSafe).ownerSetCCIPAdmin(ADDRESS_ZERO),
        'DOLOWithOwnable: Invalid CCIP admin',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).ownerSetCCIPAdmin(core.hhUser5.address),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#ownerSetMinter', () => {
    it('should work normally', async () => {
      expect(await dolo.isMinter(core.gnosisSafeAddress)).to.be.false;
      const res = await dolo.connect(core.gnosisSafe).ownerSetMinter(core.gnosisSafeAddress, true);
      await expectEvent(dolo, res, 'MinterSet', {
        minter: core.gnosisSafeAddress,
        isMinter: true,
      });
      expect(await dolo.isMinter(core.gnosisSafeAddress)).to.be.true;
    });

    it('should fail if address is not a contract', async () => {
      await expectThrow(
        dolo.connect(core.gnosisSafe).ownerSetMinter(core.hhUser5.address, true),
        'DOLOWithOwnable: Minter must be a contract',
      );
    });

    it('should fail if address zero', async () => {
      await expectThrow(
        dolo.connect(core.gnosisSafe).ownerSetMinter(ADDRESS_ZERO, true),
        'DOLOWithOwnable: Invalid minter',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).ownerSetMinter(core.hhUser5.address, true),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#transferOwnership', () => {
    it('should revert when called correctly', async () => {
      expect(await dolo.owner()).to.eq(core.gnosisSafe.address);
      await dolo.connect(core.gnosisSafe).transferOwnership(core.hhUser1.address);
      expect(await dolo.owner()).to.eq(core.hhUser1.address);
    });

    it('should fail if setting the 0 address', async () => {
      await expectThrow(
        dolo.connect(core.gnosisSafe).transferOwnership(ADDRESS_ZERO),
        'Ownable: new owner is the zero address',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        dolo.connect(core.hhUser1).transferOwnership(core.hhUser1.address),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('#renounceOwnership', () => {
    it('should revert when called correctly', async () => {
      await expectThrow(dolo.connect(core.gnosisSafe).renounceOwnership(), 'DOLOWithOwnable: Not implemented');
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(dolo.connect(core.hhUser1).renounceOwnership(), 'Ownable: caller is not the owner');
    });
  });
});

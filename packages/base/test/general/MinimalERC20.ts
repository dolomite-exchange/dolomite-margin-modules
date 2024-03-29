import { expect } from 'chai';
import { TestMinimalERC20, TestMinimalERC20__factory } from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectThrow } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

describe('MinimalERC20', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let token: TestMinimalERC20;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    token = await createContractWithAbi<TestMinimalERC20>(
      TestMinimalERC20__factory.abi,
      TestMinimalERC20__factory.bytecode,
      ['TestToken', 'TT', 18],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await token.name()).to.eq('TestToken');
      expect(await token.symbol()).to.eq('TT');
      expect(await token.decimals()).to.eq(18);
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      await token.mint(core.hhUser1.address, 100);
      expect(await token.totalSupply()).to.eq(100);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(100);
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        token.mint(ADDRESS_ZERO, 100),
        'ERC20: Mint to the zero address',
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      await token.mint(core.hhUser1.address, 100);
      await token.burn(core.hhUser1.address, 50);
      expect(await token.totalSupply()).to.eq(50);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(50);
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        token.burn(ADDRESS_ZERO, 100),
        'ERC20: Burn from the zero address',
      );
    });

    it('should fail if amount is greater than balance', async () => {
      await expectThrow(
        token.burn(core.hhUser1.address, 100),
        'ERC20: Burn amount exceeds balance',
      );
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      await token.mint(core.hhUser1.address, 100);
      await token.transfer(core.hhUser2.address, 50);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(50);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(50);
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        token.connect(zeroImpersonator).transfer(core.hhUser2.address, 150),
        'ERC20: Transfer from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(
        token.transfer(ADDRESS_ZERO, 100),
        'ERC20: Transfer to the zero address',
      );
    });

    it('should fail if amount is greater than balance', async () => {
      await expectThrow(
        token.transfer(core.hhUser2.address, 100),
        'ERC20: Transfer amount exceeds balance',
      );
    });
  });

  describe('#approve', () => {
    it('should work normally', async () => {
      await token.approve(core.hhUser2.address, 100);
      expect(await token.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(100);
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        token.connect(zeroImpersonator).approve(core.hhUser2.address, 150),
        'ERC20: Approve from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(
        token.approve(ADDRESS_ZERO, 100),
        'ERC20: Approve to the zero address',
      );
    });
  });

  describe('#transferFrom', () => {
    it('should work normally', async () => {
      await token.mint(core.hhUser1.address, 100);
      await token.approve(core.hhUser2.address, 50);
      await token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, 50);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(50);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(50);
    });

    it('should fail if not approved', async () => {
      await token.mint(core.hhUser1.address, 100);
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, 50),
        'ERC20: Insufficient allowance',
      );
    });

    it('should fail if amount greater than balance', async () => {
      await token.mint(core.hhUser1.address, 100);
      await token.approve(core.hhUser2.address, 150);
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, 150),
        'ERC20: Transfer amount exceeds balance',
      );
    });

    it('should fail if from zero address', async () => {
      await expectThrow(
        token.transferFromZeroAddress(core.hhUser2.address, 150),
        'ERC20: Transfer from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await token.mint(core.hhUser1.address, 100);
      await token.approve(core.hhUser2.address, 150);
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, ADDRESS_ZERO, 150),
        'ERC20: Transfer to the zero address',
      );
    });
  });
});

import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { DOLO, MockVotingEscrow, MockVotingEscrow__factory, RegularAirdrop } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createDOLO, createRegularAirdrop } from './tokenomics-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';

describe('RegularAirdrop', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let mockVeToken: MockVotingEscrow;
  let regularAirdrop: RegularAirdrop;

  let merkleRoot: string;
  let validProof1: string[];
  let validProof2: string[];
  let invalidProof: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core);
    mockVeToken = await createContractWithAbi<MockVotingEscrow>(
      MockVotingEscrow__factory.abi,
      MockVotingEscrow__factory.bytecode,
      [dolo.address]
    );

    const rewards = [
      { address: core.hhUser1.address, rewards: parseEther('5') },
      { address: core.hhUser2.address, rewards: parseEther('10') },
    ];
    const leaves = rewards.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(defaultAbiCoder.encode(
      ['address', 'uint256'],
      [core.hhUser3.address, parseEther('15')]
    ));
    const tree = new MerkleTree(leaves, keccak256, { sort: true });

    merkleRoot = tree.getHexRoot();
    validProof1 = tree.getHexProof(leaves[0]);
    validProof2 = tree.getHexProof(leaves[1]);
    invalidProof = tree.getHexProof(invalidLeaf);

    regularAirdrop = await createRegularAirdrop(core, dolo, mockVeToken);
    await regularAirdrop.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await core.dolomiteMargin.ownerSetGlobalOperator(regularAirdrop.address, true);

    await dolo.connect(core.governance).mint(parseEther('15'));
    await dolo.connect(core.governance).transfer(regularAirdrop.address, parseEther('15'));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await regularAirdrop.DOLO()).to.eq(dolo.address);
      expect(await regularAirdrop.VE_DOLO()).to.eq(mockVeToken.address);
      expect(await regularAirdrop.merkleRoot()).to.eq(merkleRoot);
    });
  });

  describe('#ownerSetMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await regularAirdrop.merkleRoot()).to.eq(merkleRoot);
      const res = await regularAirdrop.connect(core.governance).ownerSetMerkleRoot(BYTES_ZERO);
      await expectEvent(regularAirdrop, res, 'MerkleRootSet', {
        merkleRoot: BYTES_ZERO
      });
      expect(await regularAirdrop.merkleRoot()).to.eq(BYTES_ZERO);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        regularAirdrop.connect(core.hhUser1).ownerSetMerkleRoot(BYTES_ZERO),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerWithdrawRewardToken', () => {
    it('should work normally', async () => {
      expect(await dolo.balanceOf(core.governance.address)).to.eq(ZERO_BI);
      await regularAirdrop.connect(core.governance).ownerWithdrawRewardToken(dolo.address, core.governance.address);
      expect(await dolo.balanceOf(core.governance.address)).to.eq(parseEther('15'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        regularAirdrop.connect(core.hhUser1).ownerWithdrawRewardToken(dolo.address, core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#claim', () => {
    it('should work normally', async () => {
      const res = await regularAirdrop.connect(core.hhUser1).claim(validProof1, parseEther('5'));
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: regularAirdrop.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('5')
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('2.5'));
      expect(await dolo.balanceOf(mockVeToken.address)).to.eq(parseEther('2.5'));
      expect(await dolo.balanceOf(regularAirdrop.address)).to.eq(parseEther('10'));
      expect(await regularAirdrop.getClaimStatusByUser(core.hhUser1.address)).to.be.true;

      const res2 = await regularAirdrop.connect(core.hhUser2).claim(validProof2, parseEther('10'));
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: regularAirdrop.address,
        user: core.hhUser2.address,
        epoch: ZERO_BI,
        amount: parseEther('10')
      });
      expect(await dolo.balanceOf(core.hhUser2.address)).to.eq(parseEther('5'));
      expect(await dolo.balanceOf(mockVeToken.address)).to.eq(parseEther('7.5'));
      expect(await dolo.balanceOf(regularAirdrop.address)).to.eq(parseEther('0'));
      expect(await regularAirdrop.getClaimStatusByUser(core.hhUser2.address)).to.be.true;
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        regularAirdrop.connect(core.hhUser3).claim(invalidProof, parseEther('15')),
        'RegularAirdrop: Invalid merkle proof'
      );
    });

    it('should fail if user has already claimed', async () => {
      await regularAirdrop.connect(core.hhUser1).claim(validProof1, parseEther('5'));
      await expectThrow(
        regularAirdrop.connect(core.hhUser1).claim(validProof1, parseEther('5')),
        'RegularAirdrop: User already claimed'
      );
    });
  });
});

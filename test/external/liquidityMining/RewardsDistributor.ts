import { expect } from 'chai';
import { Bytes } from 'ethers';
import { defaultAbiCoder, keccak256 } from 'ethers/lib/utils';
import { OARB, OARB__factory, RewardsDistributor, RewardsDistributor__factory } from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { BYTES_ZERO, Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'test/utils/setup';
import { MerkleTree } from 'merkletreejs';

// const leaves = whitelisted.map(account => keccak256(account.address));
// const tree = new MerkleTree(leaves, keccak256, { sort: true });
// const merkleRoot = tree.getHexRoot();

// const merkleProof = tree.getHexProof(keccak256(whitelisted[0].address));
// const merkleProof2 = tree.getHexProof(keccak256(whitelisted[1].address));
// const invalidMerkleProof = tree.getHexProof(keccak256(notWhitelisted[0].address));

describe('RewardsDistributor', () => {
  let snapshotId: string;
  let core: CoreProtocol;
  let oARB: OARB;
  let rewardsDistributor: RewardsDistributor;
  let merkleRoot: string;
  let validProof: string[];
  let validProof2: string[];
  let invalidProof: string[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);
    rewardsDistributor = await createContractWithAbi<RewardsDistributor>(
      RewardsDistributor__factory.abi,
      RewardsDistributor__factory.bytecode,
      [core.dolomiteMargin.address, oARB.address]
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(rewardsDistributor.address, true);

    const rewards = [
        { address: core.hhUser1.address, epochs: [0], rewards: [10] },
        { address: core.hhUser2.address, epochs: [0, 1], rewards: [10, 20] },
    ]
    const leaves = rewards.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256[]', 'uint256[]'], [account.address, account.epochs, account.rewards]))
    );
    const invalidLeaf = keccak256(
      defaultAbiCoder.encode(['address', 'uint256[]', 'uint256[]'], [core.hhUser3.address, [0], [10]])
    );
    const tree = new MerkleTree(leaves, keccak256, { sort: true });

    merkleRoot = tree.getHexRoot();
    validProof = await tree.getHexProof(leaves[0]);
    validProof2 = await tree.getHexProof(leaves[1]);
    invalidProof = await tree.getHexProof(invalidLeaf);

    await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(merkleRoot);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await rewardsDistributor.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await rewardsDistributor.oARB()).to.eq(oARB.address);
    });
  });

  describe('#claim', () => {
    it('should work normally', async () => {
      await rewardsDistributor.connect(core.hhUser1).claim([0], [10], validProof);
        expect(await oARB.balanceOf(core.hhUser1.address)).to.eq(10);
        expect(await rewardsDistributor.claimStatus(core.hhUser1.address, 0)).to.be.true;
    });

    it('should work with multiple epochs', async () => {
      await rewardsDistributor.connect(core.hhUser2).claim([0, 1], [10, 20], validProof2);
        expect(await oARB.balanceOf(core.hhUser2.address)).to.eq(30);
        expect(await rewardsDistributor.claimStatus(core.hhUser2.address, 0)).to.be.true;
        expect(await rewardsDistributor.claimStatus(core.hhUser2.address, 1)).to.be.true;
    });

    it('should not distribute tokens if already claimed', async () => {
      await rewardsDistributor.connect(core.hhUser1).claim([0], [10], validProof);
      const balBefore = await oARB.balanceOf(core.hhUser1.address);
      await rewardsDistributor.connect(core.hhUser1).claim([0], [10], validProof),
      expect(await oARB.balanceOf(core.hhUser1.address)).to.eq(balBefore);
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).claim([0], [10], invalidProof),
        'RewardsDistributor: Invalid merkle proof'
      );
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).claim([0], [20], invalidProof),
        'RewardsDistributor: Invalid merkle proof'
      );
    });

    it('should fail if array lengths are incorrect', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).claim([0, 10], [10], validProof),
        'RewardsDistributor: Array length mismatch'
      );
    });
  });

  describe('#setMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await rewardsDistributor.merkleRoot()).to.eq(merkleRoot);
      const result = await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(BYTES_ZERO);
      await expectEvent(rewardsDistributor, result, 'MerkleRootSet', {
        merkleRoot: BYTES_ZERO,
      });
      expect(await rewardsDistributor.merkleRoot()).to.eq(BYTES_ZERO);
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).ownerSetMerkleRoot(merkleRoot),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setOARB', () => {
    it('should work normally', async () => {
      const newOARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [
        core.dolomiteMargin.address,
      ]);
      expect(await rewardsDistributor.oARB()).to.eq(oARB.address);
      const result = await rewardsDistributor.connect(core.governance).ownerSetOARB(newOARB.address);
      await expectEvent(rewardsDistributor, result, 'OARBSet', {
        oARB: newOARB.address,
      });
      expect(await rewardsDistributor.oARB()).to.eq(newOARB.address);
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).ownerSetOARB(core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

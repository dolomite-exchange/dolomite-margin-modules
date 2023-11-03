import { expect } from 'chai';
import { defaultAbiCoder, keccak256 } from 'ethers/lib/utils';
import { OARB, OARB__factory, RewardsDistributor, RewardsDistributor__factory } from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'test/utils/setup';
import { MerkleTree } from 'merkletreejs';

describe('RewardsDistributor', () => {
  let snapshotId: string;
  let core: CoreProtocol;
  let oARB: OARB;
  let rewardsDistributor: RewardsDistributor;
  let merkleRoot1: string;
  let merkleRoot2: string;
  let validProof1: string[];
  let validProof2: string[];
  let invalidProof: string[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(
      OARB__factory.abi,
      OARB__factory.bytecode,
      [core.dolomiteMargin.address]
    );
    rewardsDistributor = await createContractWithAbi<RewardsDistributor>(
      RewardsDistributor__factory.abi,
      RewardsDistributor__factory.bytecode,
      [core.dolomiteMargin.address, oARB.address]
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(rewardsDistributor.address, true);

    const rewards1 = [
      { address: core.hhUser1.address, rewards: 10 },
      { address: core.hhUser2.address, rewards: 10 },
    ];
    const rewards2 = [
      { address: core.hhUser1.address, rewards: 20 },
      { address: core.hhUser2.address, rewards: 20 },
    ];
    const leaves1 = rewards1.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards]))
    );
    const leaves2 = rewards2.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards]))
    );
    const invalidLeaf = keccak256(defaultAbiCoder.encode(['address', 'uint256'], [core.hhUser3.address, 10]));
    const tree1 = new MerkleTree(leaves1, keccak256, { sort: true });
    const tree2 = new MerkleTree(leaves2, keccak256, { sort: true });

    merkleRoot1 = tree1.getHexRoot();
    merkleRoot2 = tree2.getHexRoot();
    validProof1 = await tree1.getHexProof(leaves1[0]);
    validProof2 = await tree2.getHexProof(leaves2[0]);
    invalidProof = await tree1.getHexProof(invalidLeaf);

    await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(1, merkleRoot1);
    await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(2, merkleRoot2);

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
      await rewardsDistributor.connect(core.hhUser1).claim([{ epoch: 1, amount: 10, proof: validProof1 }]);
      expect(await oARB.balanceOf(core.hhUser1.address)).to.eq(10);
      expect(await rewardsDistributor.claimStatus(core.hhUser1.address, 1)).to.be.true;
    });

    it('should work with multiple epochs', async () => {
      await rewardsDistributor.connect(core.hhUser1).claim([
        { epoch: 1, amount: 10, proof: validProof1 },
        { epoch: 2, amount: 20, proof: validProof2 },
      ]);
      expect(await oARB.balanceOf(core.hhUser1.address)).to.eq(30);
      expect(await rewardsDistributor.claimStatus(core.hhUser1.address, 1)).to.be.true;
      expect(await rewardsDistributor.claimStatus(core.hhUser1.address, 2)).to.be.true;
    });

    it('should fail if tokens already claimed', async () => {
      await rewardsDistributor.connect(core.hhUser1).claim([{ epoch: 1, amount: 10, proof: validProof1 }]);
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).claim([{ epoch: 1, amount: 10, proof: validProof1 }]),
        'RewardsDistributor: Already claimed'
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser3).claim([{ epoch: 1, amount: 10, proof: invalidProof }]),
        'RewardsDistributor: Invalid merkle proof'
      );
      await expectThrow(
        rewardsDistributor.connect(core.hhUser3).claim([{ epoch: 1, amount: 10, proof: validProof1 }]),
        'RewardsDistributor: Invalid merkle proof'
      );
    });
  });

  describe('#setMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await rewardsDistributor.merkleRoots(1)).to.eq(merkleRoot1);
      const result = await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(1, merkleRoot2);
      await expectEvent(rewardsDistributor, result, 'MerkleRootSet', {
        epoch: 1,
        merkleRoot: merkleRoot2,
      });
      expect(await rewardsDistributor.merkleRoots(1)).to.eq(merkleRoot2);
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).ownerSetMerkleRoot(1, merkleRoot2),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setOARB', () => {
    it('should work normally', async () => {
      const newOARB = await createContractWithAbi<OARB>(
        OARB__factory.abi,
        OARB__factory.bytecode,
        [core.dolomiteMargin.address]
      );
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
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { TestBaseClaimWithMerkleProof, TestBaseClaimWithMerkleProof__factory } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupDAIBalance } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { UpgradeableProxy, UpgradeableProxy__factory } from 'packages/liquidity-mining/src/types';

describe('BaseClaim', () => {
  let core: CoreProtocolArbitrumOne;
  let baseClaim: TestBaseClaimWithMerkleProof;

  let merkleRoot: string;
  let validProof1: string[];
  let invalidProof: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

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
    invalidProof = tree.getHexProof(invalidLeaf);

    const baseClaimImplementation = await createContractWithAbi<TestBaseClaimWithMerkleProof>(
      TestBaseClaimWithMerkleProof__factory.abi,
      TestBaseClaimWithMerkleProof__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    const calldata = await baseClaimImplementation.populateTransaction.initialize();
    const proxy = await createContractWithAbi<UpgradeableProxy>(
      UpgradeableProxy__factory.abi,
      UpgradeableProxy__factory.bytecode,
      [baseClaimImplementation.address, core.dolomiteMargin.address, calldata.data]
    );
    baseClaim = TestBaseClaimWithMerkleProof__factory.connect(proxy.address, core.hhUser1);

    await baseClaim.connect(core.governance).ownerSetMerkleRoot(merkleRoot);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await baseClaim.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await baseClaim.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
    });
  });

  describe('#initialize', () => {
    it('should fail if called again', async () => {
      await expectThrow(
        baseClaim.connect(core.governance).initialize(),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#ownerSetMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await baseClaim.merkleRoot()).to.eq(merkleRoot);
      const res = await baseClaim.connect(core.governance).ownerSetMerkleRoot(BYTES_ZERO);
      await expectEvent(baseClaim, res, 'MerkleRootSet', {
        merkleRoot: BYTES_ZERO
      });
      expect(await baseClaim.merkleRoot()).to.eq(BYTES_ZERO);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser1).ownerSetMerkleRoot(BYTES_ZERO),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetHandler', () => {
    it('should work normally', async () => {
      expect(await baseClaim.handler()).to.eq(ADDRESS_ZERO);
      const res = await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
      await expectEvent(baseClaim, res, 'HandlerSet', {
        handler: core.hhUser5.address
      });
      expect(await baseClaim.handler()).to.eq(core.hhUser5.address);
    });

    it('should fail if handler is zero address', async () => {
      await expectThrow(
        baseClaim.connect(core.governance).ownerSetHandler(ADDRESS_ZERO),
        'BaseClaim: Invalid handler address'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser1).ownerSetHandler(core.hhUser5.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetAddressRemapping', () => {
    it('should work normally', async () => {
      await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
      const res = await baseClaim.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser1.address],
        [core.hhUser2.address]
      );
      await expectEvent(baseClaim, res, 'AddressRemappingSet', {
        users: [core.hhUser1.address],
        remappedAddresses: [core.hhUser2.address]
      });
      expect(await baseClaim.addressRemapping(core.hhUser1.address)).to.eq(core.hhUser2.address);
      expect(await baseClaim.addressRemapping(core.hhUser2.address)).to.eq(ADDRESS_ZERO);
      expect(await baseClaim.getUserOrRemappedAddress(core.hhUser1.address)).to.eq(core.hhUser2.address);
      expect(await baseClaim.getUserOrRemappedAddress(core.hhUser2.address)).to.eq(core.hhUser2.address);
    });

    it('should fail if array length mismatch', async () => {
      await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
      await expectThrow(
        baseClaim.connect(core.hhUser5).ownerSetAddressRemapping(
          [core.hhUser1.address],
          [core.hhUser2.address, core.hhUser3.address]
        ),
        'BaseClaim: Array length mismatch'
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser2).ownerSetAddressRemapping([core.hhUser1.address], [core.hhUser2.address]),
        'BaseClaim: Only handler can call'
      );
    });
  });

  describe('#ownerSetClaimEnabled', () => {
    it('should work normally', async () => {
      expect(await baseClaim.claimEnabled()).to.be.false;
      await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);

      const res = await baseClaim.connect(core.hhUser5).ownerSetClaimEnabled(true);
      await expectEvent(baseClaim, res, 'ClaimEnabledSet', {
        claimEnabled: true
      });
      expect(await baseClaim.claimEnabled()).to.be.true;
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser1).ownerSetClaimEnabled(true),
        'BaseClaim: Only handler can call'
      );
    });
  });

  describe('#ownerWithdrawRewardToken', () => {
    it('should work normally', async () => {
      await setupDAIBalance(core, core.hhUser1, parseEther('15'), core.governance);
      await core.tokens.dai.connect(core.hhUser1).transfer(baseClaim.address, parseEther('15'));

      expect(await core.tokens.dai.balanceOf(core.governance.address)).to.eq(ZERO_BI);
      await baseClaim.connect(core.governance).ownerWithdrawRewardToken(
        core.tokens.dai.address,
        core.governance.address
      );
      expect(await core.tokens.dai.balanceOf(core.governance.address)).to.eq(parseEther('15'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser1).ownerWithdrawRewardToken(core.tokens.dai.address, core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#verifyMerkleProof', () => {
    it('should work normally', async () => {
      expect(await baseClaim.connect(core.hhUser1).verifyMerkleProof(validProof1, parseEther('5'))).to.be.true;
    });

    it('should work normally if user has address remapping', async () => {
      await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
      await baseClaim.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address]
      );
      expect(await baseClaim.connect(core.hhUser4).verifyMerkleProof(validProof1, parseEther('5'))).to.be.true;
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser3).verifyMerkleProof(invalidProof, parseEther('15')),
        'TestBaseClaimWithMerkleProof: Invalid merkle proof'
      );
    });
  });

  describe('#onlyClaimEnabled', () => {
    it('should work normally', async () => {
      await expectThrow(
        baseClaim.connect(core.hhUser1).testOnlyClaimEnabled(),
        'BaseClaim: Claim is not enabled'
      );
      await baseClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
      await baseClaim.connect(core.hhUser5).ownerSetClaimEnabled(true);
      expect(await baseClaim.connect(core.hhUser1).testOnlyClaimEnabled()).to.be.true;
    });
  });
});

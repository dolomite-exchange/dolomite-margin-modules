import {
  DOLO,
  TestVeTokenClaim,
  TestVeTokenClaim__factory,
  VotingEscrow,
} from '../src/types';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';

describe('VeTokenClaim', () => {
  let core: CoreProtocolBerachain;
  let veTokenClaim: TestVeTokenClaim;

  let dolo: DOLO;
  let veDOLO: VotingEscrow;

  let merkleRootUsdc: string;
  let merkleRootWeth: string;
  let validProofUsdc1: string[];
  let validProofUsdc2: string[];
  let invalidProofUsdc: string[];
  let validProofWeth1: string[];
  let validProofWeth2: string[];
  let invalidProofWeth: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_403_500,
      network: Network.Berachain
    });
    dolo = core.tokenomics.dolo;
    veDOLO = core.tokenomics.veDolo;

    const rewardsUsdc = [
      { address: core.hhUser1.address, rewards: parseEther('5') },
      { address: core.hhUser2.address, rewards: parseEther('10') },
    ];
    const rewardsWeth = [
      { address: core.hhUser1.address, rewards: parseEther('20') },
      { address: core.hhUser2.address, rewards: parseEther('30') },
    ];
    const leavesUsdc = rewardsUsdc.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const leavesWeth = rewardsWeth.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(defaultAbiCoder.encode(
      ['address', 'uint256'],
      [core.hhUser3.address, parseEther('15')]
    ));
    const treeUsdc = new MerkleTree(leavesUsdc, keccak256, { sort: true });
    const treeWeth = new MerkleTree(leavesWeth, keccak256, { sort: true });

    merkleRootUsdc = treeUsdc.getHexRoot();
    merkleRootWeth = treeWeth.getHexRoot();
    validProofUsdc1 = treeUsdc.getHexProof(leavesUsdc[0]);
    validProofUsdc2 = treeUsdc.getHexProof(leavesUsdc[1]);
    invalidProofUsdc = treeUsdc.getHexProof(invalidLeaf);
    validProofWeth1 = treeWeth.getHexProof(leavesWeth[0]);
    validProofWeth2 = treeWeth.getHexProof(leavesWeth[1]);
    invalidProofWeth = treeWeth.getHexProof(invalidLeaf);

    veTokenClaim = await createContractWithAbi<TestVeTokenClaim>(
      TestVeTokenClaim__factory.abi,
      TestVeTokenClaim__factory.bytecode,
      [dolo.address, veDOLO.address, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await veTokenClaim.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc);
    await veTokenClaim.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.weth, merkleRootWeth);
    await veTokenClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(veTokenClaim.address, true);

    await dolo.connect(core.gnosisSafe).transfer(veTokenClaim.address, parseEther('65'));
    await veTokenClaim.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await veTokenClaim.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await veTokenClaim.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await veTokenClaim.DOLO()).to.eq(core.tokenomics.dolo.address);
      expect(await veTokenClaim.VE_DOLO()).to.eq(core.tokenomics.veDolo.address);
    });
  });

  describe('#claim', () => {
    it('should work normally with one marketId and then the next', async () => {
      let tokenId = (await veDOLO.tokenId()).add(1);
      const res = await veTokenClaim.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: parseEther('5')
      });
      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address, core.marketIds.usdc)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('5'));

      tokenId = tokenId.add(1);
      const res2 = await veTokenClaim.connect(core.hhUser1).claim([{
        marketId: core.marketIds.weth,
        proof: validProofWeth1,
        amount: parseEther('20')
      }]);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.weth,
        amount: parseEther('20')
      });
      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address, core.marketIds.weth)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('20'));
    });

    it('should work normally with two marketIds at once', async () => {
      const tokenId = (await veDOLO.tokenId()).add(1);
      const res = await veTokenClaim.connect(core.hhUser1).claim([
        {
          marketId: core.marketIds.usdc,
          proof: validProofUsdc1,
          amount: parseEther('5')
        },
        {
          marketId: core.marketIds.weth,
          proof: validProofWeth1,
          amount: parseEther('20')
        }
      ]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: parseEther('5')
      });
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.weth,
        amount: parseEther('20')
      });
      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address, core.marketIds.usdc)).to.be.true;
      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address, core.marketIds.weth)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('25'));
    });

    it('should work normally if user has address remapping', async () => {
      const tokenId = (await veDOLO.tokenId()).add(1);
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address]
      );
      const res = await veTokenClaim.connect(core.hhUser4).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: parseEther('5')
      });

      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address, core.marketIds.usdc)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('5'));
      expect(await veDOLO.ownerOf(tokenId)).to.eq(core.hhUser4.address);
    });

    it('should fail if claim is not enabled', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc1,
          amount: parseEther('5')
        }]),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if remapped user trys to claim again from original address', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address]
      );
      const res = await veTokenClaim.connect(core.hhUser4).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: parseEther('5')
      });
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc1,
          amount: parseEther('5')
        }]),
        'VeTokenClaim: User already claimed'
      );
    });

    it('should fail if original user trys to claim again from remapped address', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address]
      );
      const res = await veTokenClaim.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: parseEther('5')
      });
      await expectThrow(
        veTokenClaim.connect(core.hhUser4).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc1,
          amount: parseEther('5')
        }]),
        'VeTokenClaim: User already claimed'
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        veTokenClaim.connect(core.hhUser3).claim([{
          marketId: core.marketIds.usdc,
          proof: invalidProofUsdc,
          amount: parseEther('15')
        }]),
        `VeTokenClaim: Invalid merkle proof <${core.marketIds.usdc}>`
      );
    });

    it('should fail if user has already claimed', async () => {
      await veTokenClaim.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc1,
          amount: parseEther('5')
        }]),
        'VeTokenClaim: User already claimed'
      );
    });

    it('should fail if reentered', async () => {
      const data = await veTokenClaim.populateTransaction.claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc1,
        amount: parseEther('5')
      }]);
      await expectThrow(
        veTokenClaim.callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#ownerSetMarketIdToMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await veTokenClaim.marketIdToMerkleRoot(core.marketIds.honey)).to.eq(BYTES_ZERO);

      const res = await veTokenClaim.connect(core.governance).ownerSetMarketIdToMerkleRoot(
        core.marketIds.honey,
        merkleRootUsdc
      );
      await expectEvent(veTokenClaim, res, 'MarketIdToMerkleRootSet', {
        marketId: core.marketIds.honey,
        merkleRoot: merkleRootUsdc
      });
      expect(await veTokenClaim.marketIdToMerkleRoot(core.marketIds.honey)).to.eq(merkleRootUsdc);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

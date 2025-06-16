import {
  TestFeeRebateRollingClaims,
  TestFeeRebateRollingClaims__factory,
} from '../src/types';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { BigNumber } from 'ethers';

describe('FeeRebateRollingClaims', () => {
  let core: CoreProtocolBerachain;
  let feeRebateClaims: TestFeeRebateRollingClaims;

  let merkleRootUsdc: string;
  let merkleRootWeth: string;
  let merkleRootUsdc2: string;

  let validProofUsdc: string[];
  let validProofWeth: string[];
  let validProofUsdc2: string[];

  let invalidProofUsdc: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_403_500,
      network: Network.Berachain
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    const rewardsUsdc = [
      { address: core.hhUser1.address, rewards: BigNumber.from('500000000') },
      { address: core.hhUser2.address, rewards: BigNumber.from('1000000000') },
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
    validProofUsdc = treeUsdc.getHexProof(leavesUsdc[0]);
    invalidProofUsdc = treeUsdc.getHexProof(invalidLeaf);
    validProofWeth = treeWeth.getHexProof(leavesWeth[0]);

    const rewardsUsdc2 = [
      { address: core.hhUser1.address, rewards: BigNumber.from('1000000000') },
      { address: core.hhUser2.address, rewards: BigNumber.from('1000000000') },
    ];
    const leavesUsdc2 = rewardsUsdc2.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const treeUsdc2 = new MerkleTree(leavesUsdc2, keccak256, { sort: true });
    merkleRootUsdc2 = treeUsdc2.getHexRoot();
    validProofUsdc2 = treeUsdc2.getHexProof(leavesUsdc2[0]);

    feeRebateClaims = await createContractWithAbi<TestFeeRebateRollingClaims>(
      TestFeeRebateRollingClaims__factory.abi,
      TestFeeRebateRollingClaims__factory.bytecode,
      [core.gnosisSafe.address, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await feeRebateClaims.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc);
    await feeRebateClaims.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.weth, merkleRootWeth);
    await feeRebateClaims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(feeRebateClaims.address, true);

    await setupWETHBalance(core, core.gnosisSafe, parseEther('100'), feeRebateClaims);
    await setupUSDCBalance(core, core.gnosisSafe, BigNumber.from('2000000000'), feeRebateClaims);
    await feeRebateClaims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await feeRebateClaims.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await feeRebateClaims.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await feeRebateClaims.feeRebateAddress()).to.eq(core.gnosisSafe.address);
    });
  });

  describe('#claim', () => {
    it('should work normally with first merkle root and one marketId', async () => {
      const res = await feeRebateClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000')
      });
      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));
    });

    it('should work normally with remapped address', async () => {
      await feeRebateClaims.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address]
      );

      const res = await feeRebateClaims.connect(core.hhUser4).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000')
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000')
      });
      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser4, 0, core.marketIds.usdc, BigNumber.from('500000000'));

      await expectThrow(
        feeRebateClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000')
        }]),
        'FeeRebateRollingClaims: No amount to claim'
      );
      await expectThrow(
        feeRebateClaims.connect(core.hhUser4).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000')
        }]),
        'FeeRebateRollingClaims: No amount to claim'
      );
    });

    it('should work normally with first merkle root and two marketIds', async () => {
      const res = await feeRebateClaims.connect(core.hhUser1).claim([
        {
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000')
        },
        {
          marketId: core.marketIds.weth,
          proof: validProofWeth,
          amount: parseEther('20')
        }
      ]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000')
      });

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.weth,
        amount: parseEther('20')
      });

      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.weth))
        .to.eq(parseEther('20'));

      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.weth, parseEther('20'));
    });

    it('should work normally with second merkle root when user has not claimed', async () => {
      await feeRebateClaims.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc2);

      const res = await feeRebateClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc2,
        amount: BigNumber.from('1000000000')
      }]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('1000000000')
      });

      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('1000000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('1000000000'));
    });

    it('should work normally with second merkle root when user has already claimed', async () => {
      await feeRebateClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000')
      }]);
      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));

      await feeRebateClaims.connect(core.governance).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc2);

      const res = await feeRebateClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc2,
        amount: BigNumber.from('1000000000')
      }]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: feeRebateClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000')
      });

      expect(await feeRebateClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('1000000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('1000000000'));
    });

    it('should fail if claim is not enabled', async () => {
      await feeRebateClaims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        feeRebateClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000')
        }]),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        feeRebateClaims.connect(core.hhUser3).claim([{
          marketId: core.marketIds.usdc,
          proof: invalidProofUsdc,
          amount: BigNumber.from('15')
        }]),
        `FeeRebateRollingClaims: Invalid merkle proof <${core.marketIds.usdc}>`
      );
    });

    it('should fail if user has already claimed full amount', async () => {
      await feeRebateClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000')
      }]);
      await expectThrow(
        feeRebateClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000')
        }]),
        'FeeRebateRollingClaims: No amount to claim'
      );
    });

    it('should fail if reentered', async () => {
      const data = await feeRebateClaims.populateTransaction.claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000')
      }]);
      await expectThrow(
        feeRebateClaims.callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#ownerSetMarketIdToMerkleRoot', () => {
    it('should work normally', async () => {
      expect(await feeRebateClaims.marketIdToMerkleRoot(core.marketIds.honey)).to.eq(BYTES_ZERO);

      const res = await feeRebateClaims.connect(core.governance).ownerSetMarketIdToMerkleRoot(
        core.marketIds.honey,
        merkleRootUsdc
      );
      await expectEvent(feeRebateClaims, res, 'MarketIdToMerkleRootSet', {
        marketId: core.marketIds.honey,
        merkleRoot: merkleRootUsdc
      });
      expect(await feeRebateClaims.marketIdToMerkleRoot(core.marketIds.honey)).to.eq(merkleRootUsdc);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        feeRebateClaims.connect(core.hhUser1).ownerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetFeeRebateAddress', () => {
    it('should work normally', async () => {
      const res = await feeRebateClaims.connect(core.governance).ownerSetFeeRebateAddress(core.hhUser1.address);
      await expectEvent(feeRebateClaims, res, 'FeeRebateAddressSet', {
        feeRebateAddress: core.hhUser1.address
      });
      expect(await feeRebateClaims.feeRebateAddress()).to.eq(core.hhUser1.address);
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        feeRebateClaims.connect(core.governance).ownerSetFeeRebateAddress(ADDRESS_ZERO),
        'FeeRebateRollingClaims: Invalid fee rebate address'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        feeRebateClaims.connect(core.hhUser1).ownerSetFeeRebateAddress(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

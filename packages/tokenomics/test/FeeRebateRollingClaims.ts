import {
  FeeRebateClaimer,
  FeeRebateClaimer__factory,
  TestFeeRebateRollingClaims,
  TestFeeRebateRollingClaims__factory,
} from '../src/types';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupUSDCBalance,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther, parseUnits } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { BigNumber } from 'ethers';
import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { getRegistryProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

describe('FeeRebateRollingClaims', () => {
  let core: CoreProtocolBerachain;
  let rollingClaims: TestFeeRebateRollingClaims;
  let feeRebateClaimer: FeeRebateClaimer;

  let merkleRootUsdc: string;
  let merkleRootWeth: string;
  let merkleRootUsdc2: string;

  let totalAmountUsdc: BigNumber;
  let totalAmountWeth: BigNumber;
  let totalAmountUsdc2: BigNumber;

  let validProofUsdc: string[];
  let validProofWeth: string[];
  let validProofUsdc2: string[];

  let invalidProofUsdc: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_403_500,
      network: Network.Berachain,
    });

    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    const rewardsUsdc = [
      { address: core.hhUser1.address, rewards: BigNumber.from('500000000') },
      { address: core.hhUser2.address, rewards: BigNumber.from('1000000000') },
    ];
    totalAmountUsdc = rewardsUsdc.reduce((acc, curr) => acc.add(curr.rewards), ZERO_BI);
    const rewardsWeth = [
      { address: core.hhUser1.address, rewards: parseEther('20') },
      { address: core.hhUser2.address, rewards: parseEther('30') },
    ];
    totalAmountWeth = rewardsWeth.reduce((acc, curr) => acc.add(curr.rewards), ZERO_BI);
    const leavesUsdc = rewardsUsdc.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const leavesWeth = rewardsWeth.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(defaultAbiCoder.encode(
      ['address', 'uint256'],
      [core.hhUser3.address, parseEther('15')],
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
    totalAmountUsdc2 = rewardsUsdc2.reduce((acc, curr) => acc.add(curr.rewards), ZERO_BI);
    const leavesUsdc2 = rewardsUsdc2.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const treeUsdc2 = new MerkleTree(leavesUsdc2, keccak256, { sort: true });
    merkleRootUsdc2 = treeUsdc2.getHexRoot();
    validProofUsdc2 = treeUsdc2.getHexProof(leavesUsdc2[0]);

    feeRebateClaimer = await createContractWithAbi<FeeRebateClaimer>(
      FeeRebateClaimer__factory.abi,
      FeeRebateClaimer__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    const implementation = await createContractWithAbi<TestFeeRebateRollingClaims>(
      TestFeeRebateRollingClaims__factory.abi,
      TestFeeRebateRollingClaims__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    rollingClaims = TestFeeRebateRollingClaims__factory.connect(
      (await createContractWithAbi(
        RegistryProxy__factory.abi,
        RegistryProxy__factory.bytecode,
        getRegistryProxyConstructorParams(
          implementation.address,
          (await implementation.populateTransaction.initialize()).data!,
          core.dolomiteMargin,
        ),
      )).address,
      core.hhUser1,
    );
    await rollingClaims.connect(core.governance).ownerSetFeeRebateClaimer(feeRebateClaimer.address);

    await rollingClaims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await rollingClaims
      .connect(core.hhUser5)
      .handlerSetMerkleRoots([core.marketIds.usdc], [merkleRootUsdc], [totalAmountUsdc], 1);
    await rollingClaims
      .connect(core.hhUser5)
      .handlerSetMerkleRoots([core.marketIds.weth], [merkleRootWeth], [totalAmountWeth], 2);
    await rollingClaims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(rollingClaims.address, true);

    const claimerImp = await impersonate(feeRebateClaimer.address, true);
    const wethAmount = parseEther('100');
    const usdcAmount = BigNumber.from('2000000000');
    await setupWETHBalance(core, claimerImp, wethAmount, core.depositWithdrawalRouter);
    await setupUSDCBalance(core, claimerImp, usdcAmount, core.depositWithdrawalRouter);
    await core.depositWithdrawalRouter.connect(claimerImp).depositWei(0, 0, core.marketIds.weth, wethAmount, 0);
    await core.depositWithdrawalRouter.connect(claimerImp).depositWei(0, 0, core.marketIds.usdc, usdcAmount, 0);

    await rollingClaims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await rollingClaims.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await rollingClaims.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await rollingClaims.feeRebateClaimer()).to.eq(feeRebateClaimer.address);
    });
  });

  describe('#claim', () => {
    it('should work normally with first merkle root and one marketId', async () => {
      const res = await rollingClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000'),
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000'),
      });
      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));
    });

    it('should work normally with remapped address', async () => {
      await rollingClaims.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser4.address],
        [core.hhUser1.address],
      );

      const res = await rollingClaims.connect(core.hhUser4).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000'),
      }]);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000'),
      });
      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser4, 0, core.marketIds.usdc, BigNumber.from('500000000'));

      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000'),
        }]),
        'FeeRebateRollingClaims: No amount to claim',
      );
      await expectThrow(
        rollingClaims.connect(core.hhUser4).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000'),
        }]),
        'FeeRebateRollingClaims: No amount to claim',
      );
    });

    it('should work normally with first merkle root and two marketIds', async () => {
      const res = await rollingClaims.connect(core.hhUser1).claim([
        {
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000'),
        },
        {
          marketId: core.marketIds.weth,
          proof: validProofWeth,
          amount: parseEther('20'),
        },
      ]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000'),
      });

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.weth,
        amount: parseEther('20'),
      });

      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.weth))
        .to.eq(parseEther('20'));

      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.weth, parseEther('20'));
    });

    it('should work normally with second merkle root when user has not claimed', async () => {
      await rollingClaims
        .connect(core.hhUser5)
        .handlerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc2, totalAmountUsdc2);

      const res = await rollingClaims.connect(core.hhUser1).claim([
        {
          marketId: core.marketIds.usdc,
          proof: validProofUsdc2,
          amount: BigNumber.from('1000000000'),
        },
      ]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('1000000000'),
      });

      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc)).to.eq(
        BigNumber.from('1000000000'),
      );
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('1000000000'));
    });

    it('should work normally with second merkle root when user has already claimed', async () => {
      await rollingClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000'),
      }]);
      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('500000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('500000000'));

      const totalAmount = BigNumber.from('1000000000');
      await rollingClaims
        .connect(core.hhUser5)
        .handlerSetMarketIdToMerkleRoot(core.marketIds.usdc, merkleRootUsdc2, totalAmount);

      const res = await rollingClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc2,
        amount: BigNumber.from('1000000000'),
      }]);

      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: core.marketIds.usdc,
        amount: BigNumber.from('500000000'),
      });

      expect(await rollingClaims.userToMarketIdToClaimAmount(core.hhUser1.address, core.marketIds.usdc))
        .to.eq(BigNumber.from('1000000000'));
      await expectProtocolBalance(core, core.hhUser1, 0, core.marketIds.usdc, BigNumber.from('1000000000'));
    });

    it('should fail if claim is not enabled', async () => {
      await rollingClaims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000'),
        }]),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser3).claim([{
          marketId: core.marketIds.usdc,
          proof: invalidProofUsdc,
          amount: BigNumber.from('15'),
        }]),
        `FeeRebateRollingClaims: Invalid merkle proof <${core.marketIds.usdc}>`,
      );
    });

    it('should fail if user has already claimed full amount', async () => {
      await rollingClaims.connect(core.hhUser1).claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000'),
      }]);
      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim([{
          marketId: core.marketIds.usdc,
          proof: validProofUsdc,
          amount: BigNumber.from('500000000'),
        }]),
        'FeeRebateRollingClaims: No amount to claim',
      );
    });

    it('should fail if reentered', async () => {
      const data = await rollingClaims.populateTransaction.claim([{
        marketId: core.marketIds.usdc,
        proof: validProofUsdc,
        amount: BigNumber.from('500000000'),
      }]);
      await expectThrow(
        rollingClaims.callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#handlerSetMerkleRoots', () => {
    it('should work normally', async () => {
      const currentEpoch = await rollingClaims.currentEpoch();
      const expectedEpoch = currentEpoch.add(1);

      const res = await rollingClaims
        .connect(core.hhUser5)
        .handlerSetMerkleRoots(
          [core.marketIds.usdc],
          [merkleRootUsdc2],
          [totalAmountUsdc2],
          expectedEpoch,
        );

      await expectEvent(rollingClaims, res, 'MarketIdToMerkleRootSet', {
        marketId: core.marketIds.usdc,
        merkleRoot: merkleRootUsdc2,
        totalAmount: totalAmountUsdc2,
      });

      expect(await rollingClaims.currentEpoch()).to.eq(expectedEpoch);
      expect(await rollingClaims.marketIdToMerkleRoot(core.marketIds.usdc)).to.eq(merkleRootUsdc2);
      expect(await rollingClaims.marketIdToTotalAmount(core.marketIds.usdc)).to.eq(totalAmountUsdc2);
    });

    it('should fail if lengths not aligned', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser5).handlerSetMerkleRoots(
          [core.marketIds.usdc, core.marketIds.weth],
          [merkleRootUsdc2],
          [totalAmountUsdc2],
          3,
        ),
        'FeeRebateRollingClaims: Lengths not aligned',
      );
    });

    it('should fail if lengths are 0', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser5).handlerSetMerkleRoots([], [], [], 3),
        'FeeRebateRollingClaims: Lengths cannot be 0',
      );
    });

    it('should fail if invalid epoch', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser5).handlerSetMerkleRoots(
          [core.marketIds.usdc],
          [merkleRootUsdc2],
          [totalAmountUsdc2],
          4, // current is 2, expected should be 3
        ),
        'FeeRebateRollingClaims: Invalid epoch',
      );
    });

    it('should fail if invalid merkle root', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser5).handlerSetMerkleRoots(
          [core.marketIds.usdc],
          [BYTES_ZERO],
          [totalAmountUsdc2],
          3,
        ),
        'FeeRebateRollingClaims: Invalid merkle root',
      );
    });

    it('should fail if invalid new total', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser5).handlerSetMerkleRoots(
          [core.marketIds.usdc],
          [merkleRootUsdc2],
          [0],
          3,
        ),
        'FeeRebateRollingClaims: Invalid new total',
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser1).handlerSetMerkleRoots(
          [core.marketIds.usdc],
          [merkleRootUsdc2],
          [totalAmountUsdc2],
          3,
        ),
        'BaseClaim: Only handler can call',
      );
    });
  });

  describe('#marketIdToRemainingAmount', () => {
    it('should work normally', async () => {
      const totalAmount = await rollingClaims.marketIdToTotalAmount(core.marketIds.usdc);
      const claimedAmount = await rollingClaims.marketIdToClaimAmount(core.marketIds.usdc);
      expect(await rollingClaims.marketIdToRemainingAmount(core.marketIds.usdc)).to.eq(totalAmount.sub(claimedAmount));
    });
  });

  describe('#ownerSetFeeRebateClaimer', () => {
    it('should work normally', async () => {
      const res = await rollingClaims.connect(core.governance).ownerSetFeeRebateClaimer(core.hhUser1.address);
      await expectEvent(rollingClaims, res, 'FeeRebateClaimerSet', {
        feeRebateClaimer: core.hhUser1.address,
      });
      expect(await rollingClaims.feeRebateClaimer()).to.eq(core.hhUser1.address);
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        rollingClaims.connect(core.governance).ownerSetFeeRebateClaimer(ADDRESS_ZERO),
        'FeeRebateRollingClaims: Invalid fee rebate address',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser1).ownerSetFeeRebateClaimer(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

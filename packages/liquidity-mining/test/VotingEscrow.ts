import { CustomTestToken } from 'packages/base/src/types';
import { createContractWithAbi, createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS, ONE_ETH_BI, ONE_WEEK_SECONDS, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { increase, increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { parseEther } from 'ethers/lib/utils';
import { VeFeeCalculator, VoterAlwaysActive, VoterAlwaysActive__factory, VotingEscrow } from '../src/types';
import { createVeFeeCalculator, createVotingEscrow } from './liquidity-mining-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
// Using test addresses for vester and buyback pool for ease of testing
const VESTER_ADDRESS = '0x1111111111111111111111111111111111111111';
const BUYBACK_POOL_ADDRESS = '0x2222222222222222222222222222222222222222';
const TWO_YEARS_SECONDS = ONE_DAY_SECONDS * 365 * 2;

describe('VotingEscrow', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let token: CustomTestToken;
  let voter: VoterAlwaysActive;
  let feeCalculator: VeFeeCalculator;
  let veToken: VotingEscrow;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 219_404_000,
    });
    token = await createTestToken();
    voter = await createContractWithAbi<VoterAlwaysActive>(
      VoterAlwaysActive__factory.abi,
      VoterAlwaysActive__factory.bytecode,
      []
    );

    feeCalculator = await createVeFeeCalculator(core);
    await feeCalculator.connect(core.governance).ownerSetDecayTimestamp(1);
    veToken = await createVotingEscrow(core, token, voter.address, feeCalculator, VESTER_ADDRESS, BUYBACK_POOL_ADDRESS);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#create_lock', () => {
    it('should fail if duration is longer than 2 years', async () => {
      // it rounds down to nearest week so need to add 1 week seconds
      await expectThrow(
        veToken.connect(core.hhUser1).create_lock(100, TWO_YEARS_SECONDS + ONE_WEEK_SECONDS),
        'Voting lock can be 2 years max'
      );
    });
  });

  describe('#withdraw', () => {
    it('should work normally if lock is expired', async () => {
      await token.addBalance(core.hhUser1.address, ONE_ETH_BI);
      await token.connect(core.hhUser1).approve(veToken.address, ONE_ETH_BI);
      await veToken.connect(core.hhUser1).create_lock(ONE_ETH_BI, TWO_YEARS_SECONDS);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      await increase(TWO_YEARS_SECONDS);
      await veToken.connect(core.hhUser1).withdraw(1);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ONE_ETH_BI);
    });

    it('should handle early withdrawal fees properly', async () => {
      await token.addBalance(core.hhUser1.address, ONE_ETH_BI);
      await token.connect(core.hhUser1).approve(veToken.address, ONE_ETH_BI);

      await veToken.connect(core.hhUser1).create_lock(ONE_ETH_BI, TWO_YEARS_SECONDS);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      await increase(TWO_YEARS_SECONDS - ONE_WEEK_SECONDS);
      await veToken.connect(core.hhUser1).withdraw(1);
      // 5% burned
      // 5% * 90% sent to buyback pool
      // 5% * 10% sent to vester
      // 90% returned to user
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parseEther('.9'));
      expect(await token.totalSupply()).to.eq(parseEther('.95'));
      expect(await token.balanceOf(BUYBACK_POOL_ADDRESS)).to.eq(parseEther('.045'));
      expect(await token.balanceOf(VESTER_ADDRESS)).to.eq(parseEther('.005'));
    });
  });

  describe('#setVoter', () => {
    it('should work normally', async () => {
      expect(await veToken.voter()).to.eq(voter.address);
      await veToken.connect(core.governance).setVoter(OTHER_ADDRESS);
      expect(await veToken.voter()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        veToken.connect(core.hhUser1).setVoter(OTHER_ADDRESS),
        'not team'
      );
    });
  });

  describe('#setFeeCalculator', () => {
    it('should work normally', async () => {
      expect(await veToken.feeCalculator()).to.eq(feeCalculator.address);
      await veToken.connect(core.governance).setFeeCalculator(OTHER_ADDRESS);
      expect(await veToken.feeCalculator()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        veToken.connect(core.hhUser1).setFeeCalculator(OTHER_ADDRESS),
        'not team'
      );
    });
  });

  describe('#setVester', () => {
    it('should work normally', async () => {
      expect(await veToken.vester()).to.eq(VESTER_ADDRESS);
      await veToken.connect(core.governance).setVester(OTHER_ADDRESS);
      expect(await veToken.vester()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        veToken.connect(core.hhUser1).setVester(OTHER_ADDRESS),
        'not team'
      );
    });
  });

  describe('#setBuybackPool', () => {
    it('should work normally', async () => {
      expect(await veToken.buybackPool()).to.eq(BUYBACK_POOL_ADDRESS);
      await veToken.connect(core.governance).setBuybackPool(OTHER_ADDRESS);
      expect(await veToken.buybackPool()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        veToken.connect(core.hhUser1).setBuybackPool(OTHER_ADDRESS),
        'not team'
      );
    });
  });
});

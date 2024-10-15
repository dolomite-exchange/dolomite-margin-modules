import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  INativeRewardVault,
  IInfraredRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory,
  BGTIsolationModeVaultFactory,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import {
  ADDRESS_ZERO,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const VALIDATOR_ADDRESS = '0xB791098b00AD377B220f91d7878d19e441388eD8';
const MIN_BLOCK_LEN = 8191;
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

enum RewardVaultType {
  Native,
  Infrared,
}

describe('BerachainRewardsMetavault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metavault: BerachainRewardsMetavault;
  let ibgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let bgtVault: BGTIsolationModeTokenVaultV1;

  let marketId: BigNumber;
  let bgtMarketId: BigNumber;
  let ibgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    const metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Native,
      nativeRewardVault.address
    );
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Infrared,
      infraredRewardVault.address
    );

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(
      registry,
      core.tokens.bgt,
      bgtVaultImplementation,
      core,
    );
    const ibgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    ibgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.ibgt,
      ibgtVaultImplementation,
      core,
    );

    ibgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(ibgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await ibgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ibgtFactory.address);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metavault = BerachainRewardsMetavault__factory.connect(
      await registry.getAccountToMetavault(core.hhUser1.address),
      core.hhUser1,
    );
    bgtVault = setupUserVaultProxy<BGTIsolationModeTokenVaultV1>(
      await bgtFactory.getVaultByAccount(core.hhUser1.address),
      BGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    ibgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
      await ibgtFactory.getVaultByAccount(core.hhUser1.address),
      InfraredBGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await metavault.OWNER()).to.eq(core.hhUser1.address);
      expect(await metavault.REGISTRY()).to.eq(registry.address);
    });
  });

  describe('#stake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).stake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).unstake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      expect(bal).to.gt(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
    });

    it('should work normally with infrared', async () => {
      await registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(4));
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Infrared);

      const bal = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(ibgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect(await core.tokens.ibgt.balanceOf(metavault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        ibgtVault,
        defaultAccountNumber,
        ibgtMarketId,
        bal
      );
    });

    it('should work if no rewards are available', async () => {
      await registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Infrared);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, ibgtMarketId, ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).getReward(underlyingToken.address, RewardVaultType.Native),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work if no rewards are available', async () => {
      await registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await beraVault.exit(RewardVaultType.Infrared);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, ibgtMarketId, ZERO_BI);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).exit(underlyingToken.address, RewardVaultType.Native),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#delegateBGT', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

      await metavault.delegateBGT(core.hhUser1.address);
      expect(await core.tokens.bgt.delegates(metavault.address)).to.eq(core.hhUser1.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).delegateBGT(core.hhUser2.address),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#queueBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      const res = await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metavault, res, 'ValidatorSet', {
        validator: VALIDATOR_ADDRESS,
      });
      expect(await metavault.validator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(bal);
    });

    it('should work normally when queueing twice', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal.sub(1));
      expect(await metavault.validator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(bal.sub(1));

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, 1);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(bal);
    });

    it('should fail if there is a different active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectThrow(
        metavault.queueBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetavault: Does not match active validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#activateBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(bal);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await expectThrow(
        metavault.activateBGTBoost(core.hhUser1.address),
        'BerachainRewardsMetavault: Does not match active validator',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).activateBGTBoost(VALIDATOR_ADDRESS),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#cancelBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal.sub(ONE_ETH_BI));

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_ETH_BI);
      await metavault.cancelBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      expect(await metavault.validator()).to.eq(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(parseEther('.5'));
    });

    it('should reset validator if no boost is queued', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      const res = await metavault.cancelBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metavault, res, 'ValidatorSet', {
        validator: ADDRESS_ZERO,
      });
      expect(await metavault.validator()).to.eq(ADDRESS_ZERO);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(ZERO_BI);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      await expectThrow(
        metavault.cancelBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetavault: Does not match active validator'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).cancelBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dropBGTBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(bal);

      const res = await metavault.dropBGTBoost(VALIDATOR_ADDRESS, bal);
      await expectEvent(metavault, res, 'ValidatorSet', {
        validator: ADDRESS_ZERO,
      });
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(ZERO_BI);
      expect(await metavault.validator()).to.eq(ADDRESS_ZERO);
    });

    it('should not reset validator if still boost amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(bal);

      await metavault.dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(bal.sub(ONE_BI));
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(ZERO_BI);
      expect(await metavault.validator()).to.eq(VALIDATOR_ADDRESS);
    });

    it('should not reset validator if queued boost amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(ONE_BI);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      await metavault.dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.bgt.queuedBoost(metavault.address)).to.eq(ONE_BI);
      expect(await metavault.validator()).to.eq(VALIDATOR_ADDRESS);
    });

    it('should fail if not active validator', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);

      await expectThrow(
        metavault.dropBGTBoost(core.hhUser1.address, bal),
        'BerachainRewardsMetavault: Does not match active validator'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).dropBGTBoost(VALIDATOR_ADDRESS, ONE_BI),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawBGTAndRedeem', () => {
    it('should work normally with no boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeEtherBalance(core.hhUser1, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with queued boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeEtherBalance(core.hhUser1, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with active boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeEtherBalance(core.hhUser1, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally with queued and active boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal.div(2));
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal.div(2));
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal))
        .to.changeEtherBalance(core.hhUser1, bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should work normally if dropping a portion of a boost', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
      await bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bal.sub(ONE_ETH_BI));

      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      await mine(MIN_BLOCK_LEN);
      await metavault.activateBGTBoost(VALIDATOR_ADDRESS);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, parseEther('.5'));
      const amount = parseEther('.75');
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amount))
        .to.changeEtherBalance(core.hhUser1, amount);
      expect(await core.tokens.bgt.boosts(metavault.address)).to.eq(parseEther('.25'));
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, parseEther('.25'));
    });

    it('should fail if not called by bgt vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser1).withdrawBGTAndRedeem(core.hhUser1.address, amountWei),
        'BerachainRewardsMetavault: Not child BGT vault'
      );
    });
  });

  describe('#blocksToActivateBoost', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);
      await metavault.queueBGTBoost(VALIDATOR_ADDRESS, bal);

      expect(await metavault.blocksToActivateBoost()).to.eq(MIN_BLOCK_LEN);
      await mine();
      expect(await metavault.blocksToActivateBoost()).to.eq(MIN_BLOCK_LEN - 1);
      await mine(MIN_BLOCK_LEN - 1);
      expect(await metavault.blocksToActivateBoost()).to.eq(0);
    });

    it('should return 0 if there is no validator or no boost queued', async () => {
      expect(await metavault.blocksToActivateBoost()).to.eq(ZERO_BI);
    });
  });
});

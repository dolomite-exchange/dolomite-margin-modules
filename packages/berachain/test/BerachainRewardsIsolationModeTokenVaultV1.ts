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
} from '../src/types';
import {
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import {
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
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
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
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

describe('BerachainRewardsIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let underlyingToken: IERC20;
  let registry: BerachainRewardsRegistry;
  let factory: BerachainRewardsIsolationModeVaultFactory;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metavault: BerachainRewardsMetavault;
  let rewardVault: INativeRewardVault;
  let infraredVault: IInfraredRewardVault;
  let marketId: BigNumber;
  let ibgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });
    ibgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.ibgt.address, ONE_ETH_BI);
    await setupTestMarket(core, core.tokens.ibgt, false);

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

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
      rewardVault.address
    );
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Infrared,
      infraredVault.address
    );

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    factory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, amountWei);
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    await factory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metavault = BerachainRewardsMetavault__factory.connect(
      await registry.getAccountToMetavault(core.hhUser1.address),
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

  describe('#stake', () => {
    it('should work normally on deposit with native set as default', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await rewardVault.balanceOf(metavaultAddress)).to.equal(amountWei);
    });

    it('should work normally on deposit with infrared set as default', async () => {
      await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await infraredVault.balanceOf(metavaultAddress)).to.equal(amountWei);
    });

    it('should work normally not on deposit with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await beraVault.stake(RewardVaultType.Native, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await rewardVault.balanceOf(metavaultAddress)).to.equal(amountWei);
    });

    it('should work normally not on deposit with infrared', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredVault.balanceOf(metavaultAddress)).to.equal(amountWei);
    });

    it('should switch default type if current default type is empty', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      const res = await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        rewardVaultType: RewardVaultType.Infrared
      });
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.eq(RewardVaultType.Infrared);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredVault.balanceOf(metavaultAddress)).to.equal(amountWei);
    });

    it('should fail if type is not default and default has staked amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));

      await expectThrow(
        beraVault.stake(RewardVaultType.Infrared, amountWei.div(2)),
        'BerachainRewardsRegistry: Default type not empty'
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).stake(RewardVaultType.Native, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally for native vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await rewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for infrared vault', async () => {
      await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Infrared, amountWei);
      expect(await rewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).unstake(RewardVaultType.Native, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally for native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit(RewardVaultType.Native);
      expect(await core.tokens.bgt.balanceOf(metavaultAddress)).to.be.gt(0);
      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
    });

    it('should work normally for infrared', async () => {
      await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit(RewardVaultType.Infrared);
      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        ibgtMarketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).exit(RewardVaultType.Native),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally and stake into reward vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally if need to unstake full amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if need to unstake partial amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(amountWei.div(2));
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei.div(2));
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if no unstaking has to occur', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await rewardVault.balanceOf(metavault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await beraVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await beraVault.registry()).to.equal(registry.address);
    });
  });
});
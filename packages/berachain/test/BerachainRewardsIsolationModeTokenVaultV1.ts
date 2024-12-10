import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
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
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  IInfraredRewardVault,
  INativeRewardVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

describe('BerachainRewardsIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let iBgtVault: InfraredBGTIsolationModeTokenVaultV1;

  let marketId: BigNumber;
  let bgtMarketId: BigNumber;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);
    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
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
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should work normally on deposit with infrared set as default', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
    });

    it('should work normally not on deposit with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await beraVault.stake(RewardVaultType.Native, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await nativeRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should work normally not on deposit with infrared', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);

      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
    });

    it('should switch default type if current default type is empty', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      const res = await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        rewardVaultType: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.eq(
        RewardVaultType.Infrared,
      );

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should fail if type is not default and default has staked amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      await expectWalletBalance(beraVault, underlyingToken, amountWei.div(2));

      await expectThrow(
        beraVault.stake(RewardVaultType.Infrared, amountWei.div(2)),
        'BerachainRewardsRegistry: Default type must be empty',
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
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for infrared vault', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Infrared, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
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
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();
      expect(await core.tokens.bgt.balanceOf(metaVaultAddress)).to.be.gt(0);
      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
    });

    it('should work normally for infrared', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();

      // The iBGT vault is now created since we called Exit
      iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: iBgtVault.address, number: defaultAccountNumber },
        iBgtMarketId,
        ONE_BI,
        ZERO_BI,
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).exit(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally and stake into reward vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
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
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if need to unstake partial amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei.div(2));
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei.div(2));
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if no unstaking has to occur', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
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

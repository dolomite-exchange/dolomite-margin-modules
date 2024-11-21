import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import Web3 from 'web3';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  IERC20,
  IInfraredRewardVault,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
  MetaVaultOperator,
  MetaVaultOperator__factory,
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
} from './berachain-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

describe('BerachainRewardsRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVaultImplementation: BerachainRewardsMetaVault;
  let metaVaultOperator: MetaVaultOperator;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    metaVaultOperator = await createContractWithAbi<MetaVaultOperator>(
      MetaVaultOperator__factory.abi,
      MetaVaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, metaVaultOperator);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    otherFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      otherUnderlyingToken,
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

    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metaVaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.bgt()).to.equal(core.tokens.bgt.address);
      expect(await registry.iBgt()).to.equal(core.tokens.iBgt.address);
      expect(await registry.metaVaultImplementation()).to.equal(metaVaultImplementation.address);
      expect(await registry.metaVaultOperator()).to.equal(metaVaultOperator.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.tokens.bgt.address,
          core.tokens.iBgt.address,
          core.berachainRewardsEcosystem.iBgtStakingPool.address,
          metaVaultImplementation.address,
          metaVaultOperator.address,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#createMetaVault', () => {
    it('should work normally if no metaVault exists', async () => {
      const vaultAddress = await beraFactory.calculateVaultByAccount(core.hhUser1.address);
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      const result = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetaVaultCreated', {
        account: core.hhUser1.address,
        metaVault: metaVaultAddress,
      });

      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Native,
      );
      expect(await registry.getMetaVaultByAccount(core.hhUser1.address)).to.equal(metaVaultAddress);
      expect(await registry.getAccountByMetaVault(metaVaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getMetaVaultByVault(vaultAddress)).to.equal(metaVaultAddress);
    });

    it('should work normally if metaVault already exists', async () => {
      const vaultAddress = await beraFactory.calculateVaultByAccount(core.hhUser1.address);
      const otherVaultAddress = await otherFactory.calculateVaultByAccount(core.hhUser1.address);
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);

      const result = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetaVaultCreated', {
        account: core.hhUser1.address,
        metaVault: metaVaultAddress,
      });

      await otherFactory.createVault(core.hhUser1.address);
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Native,
      );
      expect(await registry.getMetaVaultByAccount(core.hhUser1.address)).to.equal(metaVaultAddress);
      expect(await registry.getAccountByMetaVault(metaVaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getMetaVaultByVault(vaultAddress)).to.equal(metaVaultAddress);
      expect(await registry.getMetaVaultByVault(otherVaultAddress)).to.equal(metaVaultAddress);
    });

    it('should fail if not called by a factory', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        registry.connect(core.hhUser5).createMetaVault(core.hhUser5.address, OTHER_ADDRESS),
        `BerachainRewardsRegistry: Caller is not a valid factory <${core.hhUser5.addressLower}>`,
      );
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        registry.connect(core.hhUser5).createMetaVault(core.hhUser5.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser5.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setAccountToAssetToDefaultType', () => {
    it('should work normally if called by user', async () => {
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Native,
      );
      const res = await registry
        .connect(core.hhUser1)
        .setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Infrared,
      );
    });

    it('should work normally if called by metaVault', async () => {
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Native,
      );
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      await beraFactory.createVault(core.hhUser1.address);

      const metaVaultImpersonator = await impersonate(metaVaultAddress, true);
      const res = await registry
        .connect(metaVaultImpersonator)
        .setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Infrared,
      );
    });

    it('should fail if user has staked balance in default type', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
        await beraFactory.getVaultByAccount(core.hhUser1.address),
        BerachainRewardsIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
      await registry
        .connect(core.governance)
        .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);

      const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
      await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectThrow(
        registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared),
        'BerachainRewardsRegistry: Default type not empty',
      );
    });
  });

  describe('#ownerSetBgt', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgt(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtSet', {
        bgt: OTHER_ADDRESS,
      });
      expect(await registry.bgt()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgt(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgt(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid BGT address',
      );
    });
  });

  describe('#ownerSetIBgt', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgt(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtSet', {
        iBgt: OTHER_ADDRESS,
      });
      expect(await registry.iBgt()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgt(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgt(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBGT address',
      );
    });
  });

  describe('#ownerSetIBgtStakingPool', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgtStakingPool(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtStakingPoolSet', {
        iBgtStakingPool: OTHER_ADDRESS,
      });
      expect(await registry.iBgtStakingPool()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgtStakingPool(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgtStakingPool(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBgtStakingPool address',
      );
    });
  });

  describe('#ownerSetMetaVaultImplementation', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetaVaultImplementation(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetaVaultImplementationSet', {
        metaVaultImplementation: OTHER_ADDRESS,
      });
      expect(await registry.metaVaultImplementation()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetaVaultImplementation(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetaVaultImplementation(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid implementation address',
      );
    });
  });

  describe('#ownerSetMetaVaultOperator', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetaVaultOperator(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetaVaultOperatorSet', {
        metaVaultOperator: OTHER_ADDRESS,
      });
      expect(await registry.metaVaultOperator()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetaVaultOperator(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetaVaultOperator(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid operator address',
      );
    });
  });

  describe('#ownerSetBgtIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtIsolationModeVaultFactorySet', {
        bgtIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.bgtIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid bgt factory address',
      );
    });
  });

  describe('#ownerSetIBgtIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtIsolationModeVaultFactorySet', {
        iBgtIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.iBgtIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgtIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBgt factory address',
      );
    });
  });

  describe('#ownerSetRewardVault', () => {
    it('should work normally', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVaultType = RewardVaultType.Native;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;

      const result = await registry.connect(core.governance).ownerSetRewardVault(asset, rewardVaultType, rewardVault);
      await expectEvent(registry, result, 'RewardVaultSet', {
        asset,
        rewardVaultType,
        rewardVault,
      });
      expect(await registry.rewardVault(asset, rewardVaultType)).to.equal(rewardVault);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry
          .connect(core.hhUser1)
          .ownerSetRewardVault(
            core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
            RewardVaultType.Native,
            core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address,
          ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry
          .connect(core.governance)
          .ownerSetRewardVault(
            core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
            RewardVaultType.Native,
            ADDRESS_ZERO,
          ),
        'BerachainRewardsRegistry: Invalid rewardVault address',
      );
    });
  });
});

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
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  IERC20,
  IInfraredVault,
  INativeRewardVault,
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
  impersonateUserMetaVault,
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
  let infraredRewardVault: IInfraredVault;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVaultImplementation: BerachainRewardsMetaVault;

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
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

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
      expect(await registry.berachainRewardsVaultFactory()).to.equal(
        core.berachainRewardsEcosystem.berachainRewardsVaultFactory.address
      );
      expect(await registry.infrared()).to.equal(core.berachainRewardsEcosystem.infrared.address);
      expect(await registry.bgt()).to.equal(core.tokens.bgt.address);
      expect(await registry.bgtm()).to.equal(core.berachainRewardsEcosystem.bgtm.address);
      expect(await registry.iBgt()).to.equal(core.tokens.iBgt.address);
      expect(await registry.iBgtVault()).to.equal(core.berachainRewardsEcosystem.iBgtStakingPool.address);
      expect(await registry.metaVaultImplementation()).to.equal(metaVaultImplementation.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.tokens.bgt.address,
          core.berachainRewardsEcosystem.bgtm.address,
          core.tokens.iBgt.address,
          core.berachainRewardsEcosystem.berachainRewardsVaultFactory.address,
          core.berachainRewardsEcosystem.infrared.address,
          core.berachainRewardsEcosystem.iBgtStakingPool.address,
          metaVaultImplementation.address,
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

  describe('#setDefaultRewardVaultTypeFromMetaVaultByAsset', () => {
    it('should work normally if called by meta vault', async () => {
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
        .setDefaultRewardVaultTypeFromMetaVaultByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.equal(
        RewardVaultType.Infrared,
      );
    });

    it('should fail if the caller is not the meta vault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      await expectThrow(
        registry.setDefaultRewardVaultTypeFromMetaVaultByAsset(underlyingToken.address, RewardVaultType.Infrared),
        `BerachainRewardsRegistry: Unauthorized meta vault <${core.hhUser1.addressLower}>`,
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

      const metaVault = await impersonateUserMetaVault(core.hhUser1, registry);
      await expectThrow(
        registry
          .connect(metaVault)
          .setDefaultRewardVaultTypeFromMetaVaultByAsset(underlyingToken.address, RewardVaultType.Infrared),
        'BerachainRewardsRegistry: Default type must be empty',
      );
    });
  });

  describe('#ownerSetBerachainRewardsVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBerachainRewardsVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BerachainRewardsVaultFactorySet', {
        berachainRewardsVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.berachainRewardsVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBerachainRewardsVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid vault factory address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBerachainRewardsVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetInfrared', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetInfrared(OTHER_ADDRESS);
      await expectEvent(registry, result, 'InfraredSet', {
        infrared: OTHER_ADDRESS,
      });
      expect(await registry.infrared()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetInfrared(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid infrared address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetInfrared(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

  describe('#ownerSetBgtm', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtm(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtmSet', {
        bgtm: OTHER_ADDRESS,
      });
      expect(await registry.bgtm()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtm(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid BGTM address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtm(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

  describe('#ownerSetIBgtVault', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgtVault(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtVaultSet', {
        iBgtVault: OTHER_ADDRESS,
      });
      expect(await registry.iBgtVault()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgtVault(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgtVault(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBgtVault address',
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

  describe('#ownerSetBgtmIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtmIsolationModeVaultFactorySet', {
        bgtmIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.bgtmIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid bgtm factory address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtmIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

  describe('#rewardVault', () => {
    it('should return the correct reward vault for native', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;

      expect(await registry.rewardVault(asset, RewardVaultType.Native)).to.equal(rewardVault);
    });

    it('should return the correct reward vault for infrared', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault.address;

      expect(await registry.rewardVault(asset, RewardVaultType.Infrared)).to.equal(rewardVault);
    });

    it('should return the correct reward vault for bgtm', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;

      expect(await registry.rewardVault(asset, RewardVaultType.BGTM)).to.equal(rewardVault);
    });

    it('should return the correct reward vault if overridden', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;
      expect(await registry.rewardVault(asset, RewardVaultType.Native)).to.equal(rewardVault);

      await registry.connect(core.governance).ownerSetRewardVault(asset, RewardVaultType.Native, OTHER_ADDRESS);
      expect(await registry.rewardVault(asset, RewardVaultType.Native)).to.equal(OTHER_ADDRESS);
    });
  });
});

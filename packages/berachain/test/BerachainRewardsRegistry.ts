import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  INativeRewardVault,
  IERC20,
  IInfraredRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory,
  BGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
  ZERO_BI
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType
} from './berachain-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { parseEther } from 'ethers/lib/utils';

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
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let metavaultImplementation: BerachainRewardsMetavault;
  let metavaultOperator: MetavaultOperator;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    metavaultOperator = await createContractWithAbi<MetavaultOperator>(
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

    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(ibgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await ibgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ibgtFactory.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.bgt()).to.equal(core.tokens.bgt.address);
      expect(await registry.iBgt()).to.equal(core.tokens.ibgt.address);
      expect(await registry.metavaultImplementation()).to.equal(metavaultImplementation.address);
      expect(await registry.metavaultOperator()).to.equal(metavaultOperator.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.tokens.bgt.address,
          core.tokens.ibgt.address,
          core.berachainRewardsEcosystem.iBgtStakingPool.address,
          metavaultImplementation.address,
          metavaultOperator.address,
          core.dolomiteRegistry.address
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#createMetavault', () => {
    it('should work normally if no metavault exists', async () => {
      const vaultAddress = await beraFactory.calculateVaultByAccount(core.hhUser1.address);
      const bgtVaultAddress = await bgtFactory.calculateVaultByAccount(core.hhUser1.address);
      const iBgtVaultAddress = await ibgtFactory.calculateVaultByAccount(core.hhUser1.address);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);
      const result = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });
      await expectEvent(bgtFactory, result, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: bgtVaultAddress,
      });
      await expectEvent(ibgtFactory, result, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: iBgtVaultAddress,
      });

      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      expect(await registry.getAccountToMetavault(core.hhUser1.address)).to.equal(metavaultAddress);
      expect(await registry.getMetavaultToAccount(metavaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getVaultToMetavault(vaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(bgtVaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(iBgtVaultAddress)).to.equal(metavaultAddress);
    });

    it('should work normally if iBgt vault is already created', async () => {
      const vaultAddress = await beraFactory.calculateVaultByAccount(core.hhUser1.address);
      const bgtVaultAddress = await bgtFactory.calculateVaultByAccount(core.hhUser1.address);
      const iBgtVaultAddress = await ibgtFactory.calculateVaultByAccount(core.hhUser1.address);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);
      await ibgtFactory.createVault(core.hhUser1.address);
      const result = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });

      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      expect(await registry.getAccountToMetavault(core.hhUser1.address)).to.equal(metavaultAddress);
      expect(await registry.getMetavaultToAccount(metavaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getVaultToMetavault(vaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(bgtVaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(iBgtVaultAddress)).to.equal(metavaultAddress);
    });

    it('should work normally if metavault already exists', async () => {
      const vaultAddress = await beraFactory.calculateVaultByAccount(core.hhUser1.address);
      const otherVaultAddress = await otherFactory.calculateVaultByAccount(core.hhUser1.address);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);

      const result = await beraFactory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });

      await otherFactory.createVault(core.hhUser1.address);
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      expect(await registry.getAccountToMetavault(core.hhUser1.address)).to.equal(metavaultAddress);
      expect(await registry.getMetavaultToAccount(metavaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getVaultToMetavault(vaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(otherVaultAddress)).to.equal(metavaultAddress);
    });

    // test fails during coverage because asserts are hidden
    xit('should fail if not called by a factory', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        registry.connect(core.hhUser5).createMetavault(core.hhUser5.address, OTHER_ADDRESS),
      );
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        registry.connect(core.hhUser5).createMetavault(core.hhUser5.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser5.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setAccountToAssetToDefaultType', () => {
    it('should work normally if called by user', async () => {
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
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      const res = await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Infrared);
    });

    it('should work normally if called by metavault', async () => {
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
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);
      await beraFactory.createVault(core.hhUser1.address);

      const metavaultImpersonator = await impersonate(metavaultAddress, true);
      const res = await registry.connect(metavaultImpersonator).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Infrared);
    });

    it('should fail if user has staked balance in default type', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
        await beraFactory.getVaultByAccount(core.hhUser1.address),
        BerachainRewardsIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
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

      const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
      await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectThrow(
        registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared),
        'BerachainRewardsRegistry: Default type not empty'
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
        ibgt: OTHER_ADDRESS,
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
        ibgtStakingPool: OTHER_ADDRESS,
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

  describe('#ownerSetMetavaultImplementation', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetavaultImplementation(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetavaultImplementationSet', {
        metavaultImplementation: OTHER_ADDRESS,
      });
      expect(await registry.metavaultImplementation()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetavaultImplementation(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetavaultImplementation(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid implementation address',
      );
    });
  });

  describe('#ownerSetMetavaultOperator', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetavaultOperator(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetavaultOperatorSet', {
        metavaultOperator: OTHER_ADDRESS,
      });
      expect(await registry.metavaultOperator()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetavaultOperator(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetavaultOperator(ADDRESS_ZERO),
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
        'BerachainRewardsRegistry: Invalid ibgt factory address',
      );
    });
  });

  describe('#ownerSetRewardVault', () => {
    it('should work normally', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVaultType = RewardVaultType.Native;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;

      const result = await registry.connect(core.governance).ownerSetRewardVault(
        asset,
        rewardVaultType,
        rewardVault
      );
      await expectEvent(registry, result, 'RewardVaultSet', {
        asset,
        rewardVaultType,
        rewardVault
      });
      expect(await registry.rewardVault(asset, rewardVaultType)).to.equal(rewardVault);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetRewardVault(
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
          RewardVaultType.Native,
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetRewardVault(
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
          RewardVaultType.Native,
          ADDRESS_ZERO
        ),
        'BerachainRewardsRegistry: Invalid rewardVault address',
      );
    });
  });
});

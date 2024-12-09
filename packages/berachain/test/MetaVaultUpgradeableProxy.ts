import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BGTIsolationModeVaultFactory,
  IERC20,
  IInfraredRewardVault,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
  MetaVaultUpgradeableProxy,
  MetaVaultUpgradeableProxy__factory,
  TestBerachainRewardsRegistry
} from '../src/types';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from 'packages/base/test/utils/setup';
import { Network, ONE_ETH_BI } from 'packages/base/src/utils/no-deps-constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  createTestBerachainRewardsRegistry,
  RewardVaultType
} from './berachain-ecosystem-utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectThrow } from 'packages/base/test/utils/assertions';

describe('MetaVaultUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: TestBerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let metaVaultImplementation: BerachainRewardsMetaVault;
  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let vaultProxy: MetaVaultUpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createTestBerachainRewardsRegistry(core, metaVaultImplementation);
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
    const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
    vaultProxy = await setupUserVaultProxy<MetaVaultUpgradeableProxy>(
      metaVaultAddress,
      MetaVaultUpgradeableProxy__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work under normal conditions', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, beraVault.address);
      const vault2Address = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<MetaVaultUpgradeableProxy>(
        vault2Address,
        MetaVaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await vault2.initialize(core.hhUser2.address);
      expect(await vault2.isInitialized()).to.eq(true);
      expect(await vault2.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if the account and metaVault do not match' , async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, beraVault.address);
      const vault2Address = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<MetaVaultUpgradeableProxy>(
        vault2Address,
        MetaVaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await expectThrow(
        vault2.initialize(core.hhUser3.address),
        `MetaVaultUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`
      );
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        vaultProxy.initialize(core.hhUser1.address),
        'MetaVaultUpgradeableProxy: Already initialized',
      );
    });
  });

  describe('#receive', () => {
    it('should fail because no receive on implementation', async () => {
      await expectThrow(
        core.hhUser1.sendTransaction({
          to: vaultProxy.address,
          value: ONE_ETH_BI,
          data: '0x'
        }),
        'function selector was not recognized and there\'s no fallback nor receive function'
      );
    });
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const vaultImpl = setupUserVaultProxy<BerachainRewardsMetaVault>(
        vaultProxy.address,
        BerachainRewardsMetaVault__factory,
        core.hhUser1,
      );
      expect(await vaultImpl.OWNER()).to.eq(core.hhUser1.address);
    });

    it('should fail when not initialized', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, beraVault.address);
      const metaAddress = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const vaultImpl = setupUserVaultProxy<BerachainRewardsMetaVault>(
        metaAddress,
        BerachainRewardsMetaVault__factory,
        core.hhUser2,
      );
      await expectThrow(vaultImpl.OWNER(), 'MetaVaultUpgradeableProxy: Not initialized');
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.implementation()).to.eq(metaVaultImplementation.address);
    });
  });

  describe('#isInitialized', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.isInitialized()).to.eq(true);
    });
  });

  describe('#REGISTRY', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.registry()).to.eq(registry.address);
    });
  });

  describe('#owner', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.owner()).to.eq(core.hhUser1.address);
    });
  });
});

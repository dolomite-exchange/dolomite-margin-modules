import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BGTIsolationModeVaultFactory,
  IERC20,
  IInfraredRewardVault,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
  MetavaultOperator,
  MetavaultOperator__factory,
  MetavaultUpgradeableProxy,
  MetavaultUpgradeableProxy__factory,
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

describe('MetavaultUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: TestBerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let metavaultImplementation: BerachainRewardsMetavault;
  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let vaultProxy: MetavaultUpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    const metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createTestBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
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

    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

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
    const metavaultAddress = await registry.getAccountToMetavault(core.hhUser1.address);
    vaultProxy = await setupUserVaultProxy<MetavaultUpgradeableProxy>(
      metavaultAddress,
      MetavaultUpgradeableProxy__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work under normal conditions', async () => {
      await registry.createMetavaultNoInitialize(core.hhUser2.address, beraVault.address);
      const vault2Address = await registry.getAccountToMetavault(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<MetavaultUpgradeableProxy>(
        vault2Address,
        MetavaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await vault2.initialize(core.hhUser2.address);
      expect(await vault2.isInitialized()).to.eq(true);
      expect(await vault2.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if the account and metavault do not match' , async () => {
      await registry.createMetavaultNoInitialize(core.hhUser2.address, beraVault.address);
      const vault2Address = await registry.getAccountToMetavault(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<MetavaultUpgradeableProxy>(
        vault2Address,
        MetavaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await expectThrow(
        vault2.initialize(core.hhUser3.address),
        `MetavaultUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`
      );
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        vaultProxy.initialize(core.hhUser1.address),
        'MetavaultUpgradeableProxy: Already initialized',
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
      const vaultImpl = setupUserVaultProxy<BerachainRewardsMetavault>(
        vaultProxy.address,
        BerachainRewardsMetavault__factory,
        core.hhUser1,
      );
      expect(await vaultImpl.OWNER()).to.eq(core.hhUser1.address);
    });

    it('should fail when not initialized', async () => {
      await registry.createMetavaultNoInitialize(core.hhUser2.address, beraVault.address);
      const metaAddress = await registry.getAccountToMetavault(core.hhUser2.address);
      const vaultImpl = setupUserVaultProxy<BerachainRewardsMetavault>(
        metaAddress,
        BerachainRewardsMetavault__factory,
        core.hhUser2,
      );
      await expectThrow(vaultImpl.OWNER(), 'MetavaultUpgradeableProxy: Not initialized');
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.implementation()).to.eq(metavaultImplementation.address);
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

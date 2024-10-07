import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
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
  createTestBerachainRewardsRegistry
} from './berachain-ecosystem-utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectThrow } from 'packages/base/test/utils/assertions';

describe('MetavaultUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: TestBerachainRewardsRegistry;
  let factory: BerachainRewardsIsolationModeVaultFactory;
  let metavaultImplementation: BerachainRewardsMetavault;

  let vaultProxy: MetavaultUpgradeableProxy;
  let vaultAddress: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });
    const underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
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
    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    factory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core
    );

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    await factory.createVault(core.hhUser1.address);
    vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
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
      await registry.createMetavaultNoInitialize(core.hhUser2.address, vaultAddress);
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
      await registry.createMetavaultNoInitialize(core.hhUser2.address, vaultAddress);
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
      await registry.createMetavaultNoInitialize(core.hhUser2.address, vaultAddress);
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
      expect(await vaultProxy.REGISTRY()).to.eq(registry.address);
    });
  });

  describe('#owner', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.owner()).to.eq(core.hhUser1.address);
    });
  });
});

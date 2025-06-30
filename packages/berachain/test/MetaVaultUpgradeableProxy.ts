import { expect } from 'chai';
import { DolomiteERC4626, DolomiteERC4626__factory } from 'packages/base/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6 } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from 'packages/base/test/utils/setup';
import {
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  MetaVaultUpgradeableProxy,
  MetaVaultUpgradeableProxy__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeVaultFactory,
  TestBerachainRewardsRegistry,
} from '../src/types';
import {
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory,
  createPolLiquidatorProxy,
  createTestBerachainRewardsRegistry,
} from './berachain-ecosystem-utils';

describe('MetaVaultUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: TestBerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let dToken: DolomiteERC4626;

  let metaVaultImplementation: InfraredBGTMetaVault;
  let polVault: POLIsolationModeTokenVaultV1;
  let metaVaultProxy: MetaVaultUpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });

    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const liquidatorProxyV6 = await createLiquidatorProxyV6(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV6);
    metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createTestBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    await factory.createVault(core.hhUser1.address);
    polVault = setupUserVaultProxy<POLIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      POLIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
    metaVaultProxy = setupUserVaultProxy<MetaVaultUpgradeableProxy>(
      metaVaultAddress,
      MetaVaultUpgradeableProxy__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  // Some of these tests are weird because we are reusing polVault address for core.hhUser2
  // but we are doing it mainly to test the initialize function
  describe('#initialize', () => {
    it('should work under normal conditions', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, polVault.address);
      const newMetaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const newMetaVault = setupUserVaultProxy<MetaVaultUpgradeableProxy>(
        newMetaVaultAddress,
        MetaVaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await newMetaVault.initialize(core.hhUser2.address);
      expect(await newMetaVault.isInitialized()).to.eq(true);
      expect(await newMetaVault.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if the account and metaVault do not match', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, polVault.address);
      const newMetaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const newMetaVault = setupUserVaultProxy<MetaVaultUpgradeableProxy>(
        newMetaVaultAddress,
        MetaVaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await expectThrow(
        newMetaVault.initialize(core.hhUser3.address),
        `MetaVaultUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`,
      );
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        metaVaultProxy.initialize(core.hhUser1.address),
        'MetaVaultUpgradeableProxy: Already initialized',
      );
    });
  });

  describe('#receive', () => {
    it('should work normally', async () => {
      await core.hhUser1.sendTransaction({
        to: metaVaultProxy.address,
        value: ONE_ETH_BI,
        data: '0x',
      });
    });

    it('should fail if not initialized', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, polVault.address);
      const newMetaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser2.address);
      await expectThrow(
        core.hhUser1.sendTransaction({
          to: newMetaVaultAddress,
          value: ONE_ETH_BI,
          data: '0x',
        }),
        'MetaVaultUpgradeableProxy: Not initialized',
      );
    });
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const metaVault = setupUserVaultProxy<InfraredBGTMetaVault>(
        metaVaultProxy.address,
        InfraredBGTMetaVault__factory,
        core.hhUser1,
      );
      expect(await metaVault.OWNER()).to.eq(core.hhUser1.address);
    });

    it('should fail when not initialized', async () => {
      await registry.createMetaVaultNoInitialize(core.hhUser2.address, polVault.address);
      const newMetaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser2.address);
      const newMetaVault = setupUserVaultProxy<InfraredBGTMetaVault>(
        newMetaVaultAddress,
        InfraredBGTMetaVault__factory,
        core.hhUser2,
      );
      await expectThrow(newMetaVault.OWNER(), 'MetaVaultUpgradeableProxy: Not initialized');
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await metaVaultProxy.implementation()).to.eq(metaVaultImplementation.address);
    });
  });

  describe('#isInitialized', () => {
    it('should work normally', async () => {
      expect(await metaVaultProxy.isInitialized()).to.eq(true);
    });
  });

  describe('#REGISTRY', () => {
    it('should work normally', async () => {
      expect(await metaVaultProxy.registry()).to.eq(registry.address);
    });
  });

  describe('#owner', () => {
    it('should work normally', async () => {
      expect(await metaVaultProxy.owner()).to.eq(core.hhUser1.address);
    });
  });
});

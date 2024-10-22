import { expect } from 'chai';
import {
  IsolationModeUpgradeableProxy,
  IsolationModeUpgradeableProxy__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV2__factory,
} from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../utils/setup';

describe('IsolationModeUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let factory: TestIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;

  let vaultProxy: IsolationModeUpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    const underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    await setupTestMarket(core, factory, true);

    const tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );

    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vaultProxy = await setupUserVaultProxy<IsolationModeUpgradeableProxy>(
      vaultAddress,
      IsolationModeUpgradeableProxy__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work under normal conditions', async () => {
      await factory.createVaultNoInitialize(core.hhUser2.address);
      const vault2Address = await factory.getVaultByAccount(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<IsolationModeUpgradeableProxy>(
        vault2Address,
        IsolationModeUpgradeableProxy__factory,
        core.hhUser2,
      );
      await vault2.initialize(core.hhUser2.address);
      expect(await vault2.isInitialized()).to.eq(true);
      expect(await vault2.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        vaultProxy.initialize(core.hhUser1.address),
        'IsolationModeUpgradeableProxy: Already initialized',
      );
    });

    it('should fail if invalid account', async () => {
      await expectThrow(
        factory.createVaultWithDifferentAccount(core.hhUser2.address, core.hhUser3.address),
        `IsolationModeUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`,
      );
    });
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const vaultImpl = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        vaultProxy.address,
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      expect(await vaultImpl.VAULT_FACTORY()).to.eq(factory.address);
    });

    it('should fail when not initialized', async () => {
      await factory.createVaultNoInitialize(core.hhUser2.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser2.address);
      const vaultImpl = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        vaultAddress,
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );
      await expectThrow(vaultImpl.VAULT_FACTORY(), 'IsolationModeUpgradeableProxy: Not initialized');
    });
  });

  describe('#implementation', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.implementation()).to.eq(userVaultImplementation.address);
    });
  });

  describe('#isInitialized', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.isInitialized()).to.eq(true);
    });
  });

  describe('#vaultFactory', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.vaultFactory()).to.eq(factory.address);
    });
  });

  describe('#owner', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.owner()).to.eq(core.hhUser1.address);
    });
  });
});

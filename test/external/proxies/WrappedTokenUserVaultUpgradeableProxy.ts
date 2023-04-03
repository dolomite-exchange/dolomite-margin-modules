import { expect } from 'chai';
import { BaseContract } from 'ethers';
import {
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultUnwrapper__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultUpgradeableProxy,
  WrappedTokenUserVaultUpgradeableProxy__factory,
} from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { createTestWrappedTokenFactory } from '../../utils/wrapped-token-utils';

describe('WrappedTokenUserVaultUpgradeableProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let factory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;

  let vaultProxy: WrappedTokenUserVaultUpgradeableProxy;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    const underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createTestWrappedTokenFactory(core, underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    await setupTestMarket(core, factory, true);

    const tokenUnwrapper = await createContractWithAbi(
      TestWrappedTokenUserVaultUnwrapper__factory.abi,
      TestWrappedTokenUserVaultUnwrapper__factory.bytecode,
      [core.usdc.address, factory.address, core.dolomiteMargin.address],
    );

    await factory.connect(core.governance).initialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vaultProxy = await setupUserVaultProxy<WrappedTokenUserVaultUpgradeableProxy>(
      vaultAddress,
      WrappedTokenUserVaultUpgradeableProxy__factory,
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
      const vault2 = setupUserVaultProxy<WrappedTokenUserVaultUpgradeableProxy>(
        vault2Address,
        WrappedTokenUserVaultUpgradeableProxy__factory,
        core.hhUser2,
      );
      await vault2.initialize(core.hhUser2.address);
      expect(await vault2.isInitialized()).to.eq(true);
      expect(await vault2.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        vaultProxy.initialize(core.hhUser1.address),
        'WrappedUserVaultUpgradeableProxy: Already initialized',
      );
    });

    it('should fail if invalid account', async () => {
      await expectThrow(
        factory.createVaultWithDifferentAccount(core.hhUser2.address, core.hhUser3.address),
        `WrappedUserVaultUpgradeableProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`,
      );
    });
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const vaultImpl = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        vaultProxy.address,
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser1,
      );
      expect(await vaultImpl.VAULT_FACTORY()).to.eq(factory.address);
    });

    it('should fail when not initialized', async () => {
      await factory.createVaultNoInitialize(core.hhUser2.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser2.address);
      const vaultImpl = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        vaultAddress,
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser2,
      );
      await expectThrow(vaultImpl.VAULT_FACTORY(), 'WrappedUserVaultUpgradeableProxy: Not initialized');
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

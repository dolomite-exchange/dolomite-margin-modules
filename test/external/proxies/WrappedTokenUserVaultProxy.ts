import { expect } from 'chai';
import { BaseContract } from 'ethers';
import {
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultProxy,
  WrappedTokenUserVaultProxy__factory,
} from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { createGlpUnwrapperProxy, createWrappedTokenFactory } from './wrapped-token-utils';

describe('WrappedTokenUserVaultProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let wrappedTokenFactory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;

  let vaultProxy: WrappedTokenUserVaultProxy;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    const underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    wrappedTokenFactory = await createWrappedTokenFactory(underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      wrappedTokenFactory.address,
      '1000000000000000000', // $1.00
    );

    await setupTestMarket(core, wrappedTokenFactory, true);

    const tokenUnwrapper = await createGlpUnwrapperProxy(wrappedTokenFactory);
    await wrappedTokenFactory.initialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrappedTokenFactory.address, true);

    await wrappedTokenFactory.createVault(core.hhUser1.address);
    const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
    vaultProxy = await setupUserVaultProxy<WrappedTokenUserVaultProxy>(
      vaultAddress,
      WrappedTokenUserVaultProxy__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work under normal conditions', async () => {
      await wrappedTokenFactory.createVaultNoInitialize(core.hhUser2.address);
      const vault2Address = await wrappedTokenFactory.getVaultByAccount(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<WrappedTokenUserVaultProxy>(
        vault2Address,
        WrappedTokenUserVaultProxy__factory,
        core.hhUser2,
      );
      await vault2.initialize(core.hhUser2.address);
      expect(await vault2.isInitialized()).to.eq(true);
      expect(await vault2.owner()).to.eq(core.hhUser2.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        vaultProxy.initialize(core.hhUser1.address),
        'WrappedTokenUserVaultProxy: Already initialized',
      );
    });

    it('should fail if invalid account', async () => {
      await expectThrow(
        wrappedTokenFactory.createVaultWithDifferentAccount(core.hhUser2.address, core.hhUser3.address),
        `WrappedTokenUserVaultProxy: Invalid account <${core.hhUser3.address.toLowerCase()}>`,
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
      expect(await vaultImpl.VAULT_FACTORY()).to.eq(wrappedTokenFactory.address);
    });

    it('should fail when not initialized', async () => {
      await wrappedTokenFactory.createVaultNoInitialize(core.hhUser2.address);
      const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser2.address);
      const vaultImpl = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
        vaultAddress,
        TestWrappedTokenUserVaultV1__factory,
        core.hhUser2,
      );
      await expectThrow(vaultImpl.VAULT_FACTORY(), 'WrappedTokenUserVaultProxy: Not initialized');
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
      expect(await vaultProxy.vaultFactory()).to.eq(wrappedTokenFactory.address);
    });
  });

  describe('#owner', () => {
    it('should work normally', async () => {
      expect(await vaultProxy.owner()).to.eq(core.hhUser1.address);
    });
  });
});

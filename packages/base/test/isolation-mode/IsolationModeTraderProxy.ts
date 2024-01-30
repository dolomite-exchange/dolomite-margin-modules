import { expect } from 'chai';
import { createContractWithLibrary, createContractWithLibraryAndArtifact, createTestToken } from '../../src/utils/dolomite-utils';
import { createTestIsolationModeFactory } from '../utils/ecosystem-utils/testers';
import {
  CustomTestToken,
  IsolationModeTraderProxy,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
} from '../../src/types';
// @todo create test contract for this
import {
  TestGmxV2IsolationModeUnwrapperTraderV2,
  TestGmxV2IsolationModeUnwrapperTraderV2__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import TestGmxV2IsolationModeUnwrapperTraderV2Artifact from '@dolomite-exchange/modules-gmx-v2/artifacts/contracts/test/TestGmxV2IsolationModeUnwrapperTraderV2.sol/TestGmxV2IsolationModeUnwrapperTraderV2.json';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createDolomiteRegistryImplementation,
  createIsolationModeTokenVaultV1ActionsImpl,
  createIsolationModeTraderProxy,
} from '../utils/dolomite';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { createGmxV2Library } from '@dolomite-exchange/modules-gmx-v2/test/gmx-v2-ecosystem-utils';
import { createSafeDelegateLibrary } from '../utils/ecosystem-utils/general';

describe('IsolationModeTraderProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let otherToken: CustomTestToken;
  let implementation: TestGmxV2IsolationModeUnwrapperTraderV2;
  let factory: TestIsolationModeFactory;
  let proxy: IsolationModeTraderProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    const vaultLibraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      vaultLibraries,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);

    const gmxV2Library = await createGmxV2Library();
    const safeDelegateCallLibrary = await createSafeDelegateLibrary();
    const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
    implementation = await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeUnwrapperTraderV2>(
      TestGmxV2IsolationModeUnwrapperTraderV2Artifact,
      { GmxV2Library: gmxV2Library.address, SafeDelegateCallLib: safeDelegateCallLibrary.address, ...libraries },
      [core.tokens.weth.address],
    );
    const calldata = await implementation.populateTransaction.initialize(
      factory.address,
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address
    );
    proxy = await createIsolationModeTraderProxy(implementation.address, calldata.data!, core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const trader = TestGmxV2IsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
      expect(await trader.VAULT_FACTORY()).to.eq(factory.address);
    });
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createDolomiteRegistryImplementation();
      await expectEvent(
        proxy,
        await proxy.connect(core.governance).upgradeTo(newImplementation.address),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await proxy.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeTo(implementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      await expectThrow(
        proxy.connect(core.governance).upgradeTo(core.hhUser1.address),
        'IsolationModeTraderProxy: Implementation is not a contract',
      );
    });
  });

  describe('#upgradeToAndCall', () => {
    it('should work normally', async () => {
      const newImplementation = await createDolomiteRegistryImplementation();
      const calldata = await newImplementation.populateTransaction.ownerSetGenericTraderProxy(
        core.genericTraderProxy!.address,
      );
      await expectEvent(
        proxy,
        await proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await proxy.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      const calldata = await implementation.populateTransaction.actionsLength();
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await implementation.populateTransaction.actionsLength();
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'IsolationModeTraderProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const gmxV2Library = await createGmxV2Library();
      const safeDelegateCallLibrary = await createSafeDelegateLibrary();
      const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
      const newImplementation = await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeUnwrapperTraderV2>(
        TestGmxV2IsolationModeUnwrapperTraderV2Artifact,
        { GmxV2Library: gmxV2Library.address, SafeDelegateCallLib: safeDelegateCallLibrary.address, ...libraries },
        [core.tokens.weth.address],
      );
      const calldata = await implementation.populateTransaction.getExchangeCost(
        core.tokens.weth.address,
        core.tokens.weth.address,
        ZERO_BI,
        BYTES_EMPTY,
      );
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });
});

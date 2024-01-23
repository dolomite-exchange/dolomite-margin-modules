import { expect } from 'chai';
import { createContractWithLibrary, createTestToken } from '../../src/utils/dolomite-utils';
import { createTestIsolationModeFactory } from '../utils/ecosystem-token-utils/testers';
import {
  CustomTestToken,
  IsolationModeTraderProxy,
  TestAsyncUpgradeableIsolationModeWrapperTrader,
  TestAsyncUpgradeableIsolationModeWrapperTrader__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
} from '../../src/types';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import {
  createAsyncIsolationModeWrapperTraderImpl,
  createDolomiteRegistryImplementation,
  createIsolationModeTokenVaultV1ActionsImpl,
  createIsolationModeTraderProxy,
} from '../utils/dolomite';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

describe('IsolationModeTraderProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let otherToken: CustomTestToken;
  let implementation: TestAsyncUpgradeableIsolationModeWrapperTrader;
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

    const wrapperLibraries = await createAsyncIsolationModeWrapperTraderImpl();
    implementation = await createContractWithLibrary<TestAsyncUpgradeableIsolationModeWrapperTrader>(
      'TestAsyncUpgradeableIsolationModeWrapperTrader',
      wrapperLibraries,
      [],
    );
    const calldata = await implementation.populateTransaction.initialize(
      otherToken.address,
      factory.address,
      core.dolomiteMargin.address,
    );
    proxy = await createIsolationModeTraderProxy(implementation.address, calldata.data!, core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#fallback', () => {
    it('should work normally', async () => {
      const trader = TestAsyncUpgradeableIsolationModeWrapperTrader__factory.connect(proxy.address, core.hhUser1);
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
      const libraries = await createAsyncIsolationModeWrapperTraderImpl();
      const newImplementation = await createContractWithLibrary<TestAsyncUpgradeableIsolationModeWrapperTrader>(
        'TestAsyncUpgradeableIsolationModeWrapperTrader',
        libraries,
        [],
      );
      const calldata = await implementation.populateTransaction.getExchangeCost(
        core.tokens.weth.address,
        core.tokens.weth.address,
        ZERO_BI,
        BYTES_EMPTY,
      );
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });
});

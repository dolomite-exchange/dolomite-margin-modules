import { expect } from 'chai';
import {
  CustomTestToken,
  IsolationModeTraderProxy,
  TestAsyncIsolationModeTraderBase,
  TestAsyncIsolationModeTraderBase__factory,
  TestHandlerRegistry,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
} from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  createDolomiteRegistryImplementation,
  createIsolationModeTokenVaultV1ActionsImpl,
  createIsolationModeTraderProxy,
} from '../utils/dolomite';
import { createTestHandlerRegistry, createTestIsolationModeFactory } from '../utils/ecosystem-utils/testers';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

describe('IsolationModeTraderProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let implementation: TestAsyncIsolationModeTraderBase;
  let factory: TestIsolationModeFactory;
  let proxy: IsolationModeTraderProxy;
  let registry: TestHandlerRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    const vaultLibraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      vaultLibraries,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
    registry = await createTestHandlerRegistry(core);

    implementation = await createContractWithAbi<TestAsyncIsolationModeTraderBase>(
      TestAsyncIsolationModeTraderBase__factory.abi,
      TestAsyncIsolationModeTraderBase__factory.bytecode,
      [core.tokens.weth.address],
    );
    const calldata = await implementation.populateTransaction.initialize(
      registry.address,
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
      const trader = TestAsyncIsolationModeTraderBase__factory.connect(proxy.address, core.hhUser1);
      expect(await trader.HANDLER_REGISTRY()).to.eq(registry.address);
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
      const calldata = await implementation.populateTransaction.HANDLER_REGISTRY();
      await expectThrow(
        proxy.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await implementation.populateTransaction.HANDLER_REGISTRY();
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'IsolationModeTraderProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const newImplementation = await createContractWithAbi<TestAsyncIsolationModeTraderBase>(
        TestAsyncIsolationModeTraderBase__factory.abi,
        TestAsyncIsolationModeTraderBase__factory.bytecode,
        [core.tokens.weth.address],
      );
      const calldata = await implementation.populateTransaction.testRevert();
      await expectThrow(
        proxy.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'TestAsyncIsolationModeTraderBase: revert',
      );
    });
  });
});

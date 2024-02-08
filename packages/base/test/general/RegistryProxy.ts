import { expect } from 'chai';
import { DolomiteRegistryImplementation, RegistryProxy } from '../../src/types';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { createDolomiteRegistryImplementation, createRegistryProxy } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

describe('RegistryProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let implementation: DolomiteRegistryImplementation;
  let registry: RegistryProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    implementation = await createDolomiteRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(
      core.genericTraderProxy!.address,
      core.expiry!.address,
      core.constants.slippageToleranceForPauseSentinel,
      core.liquidatorAssetRegistry.address,
      core.eventEmitterRegistryProxy.address,
      core.chainlinkPriceOracle.address,
    );
    registry = await createRegistryProxy(implementation.address, calldata.data!, core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#upgradeTo', () => {
    it('should work normally', async () => {
      const newImplementation = await createDolomiteRegistryImplementation();
      await expectEvent(
        registry,
        await registry.connect(core.governance).upgradeTo(newImplementation.address),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await registry.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).upgradeTo(implementation.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      await expectThrow(
        registry.connect(core.governance).upgradeTo(core.hhUser1.address),
        'RegistryProxy: Implementation is not a contract',
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
        registry,
        await registry.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        'ImplementationSet',
        { newImplementation: newImplementation.address },
      );
      expect(await registry.implementation()).to.equal(newImplementation.address);
    });

    it('should fail when not called by owner', async () => {
      const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(
        core.genericTraderProxy!.address,
      );
      await expectThrow(
        registry.connect(core.hhUser1).upgradeToAndCall(implementation.address, calldata.data!),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when new implementation is not a contract', async () => {
      const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(
        core.genericTraderProxy!.address,
      );
      await expectThrow(
        registry.connect(core.governance).upgradeToAndCall(core.hhUser1.address, calldata.data!),
        'RegistryProxy: Implementation is not a contract',
      );
    });

    it('should fail when call to the new implementation fails', async () => {
      const newImplementation = await createDolomiteRegistryImplementation();
      const calldata = await implementation.populateTransaction.ownerSetGenericTraderProxy(
        core.dolomiteMargin!.address,
      );
      await expectThrow(
        registry.connect(core.governance).upgradeToAndCall(newImplementation.address, calldata.data!),
        `ValidationLib: Call to target failed <${core.dolomiteMargin.address.toLowerCase()}>`,
      );
    });
  });
});

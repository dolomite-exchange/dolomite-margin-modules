import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { createDolomiteRegistryImplementation, createRegistryProxy } from '../../utils/dolomite';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteRegistryImplementation', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let implementation: DolomiteRegistryImplementation;
  let registry: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    implementation = await createDolomiteRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(core.genericTraderProxy!.address);
    const registryProxy = await createRegistryProxy(implementation.address, calldata.data!, core);
    registry = DolomiteRegistryImplementation__factory.connect(registryProxy.address, core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.genericTraderProxy()).to.equal(core.genericTraderProxy!.address);
    });

    it('should fail to initialize if already initialized', async () => {
      await expectThrow(
        registry.initialize(core.genericTraderProxy!.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#slippageToleranceForPauseSentinelBase', () => {
    it('should return 1e18', async () => {
      expect(await registry.slippageToleranceForPauseSentinelBase()).to.equal('1000000000000000000');
    });
  });

  describe('#ownerSetGenericTraderProxy', () => {
    it('should work normally', async () => {
      const genericTraderProxy = core.genericTraderProxy!.address;
      const result = await registry.connect(core.governance).ownerSetGenericTraderProxy(genericTraderProxy);
      await expectEvent(registry, result, 'GenericTraderProxySet', {
        genericTraderProxy,
      });
      expect(await registry.genericTraderProxy()).to.equal(genericTraderProxy);
    });

    it('should fail if genericTraderProxy is invalid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGenericTraderProxy(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGenericTraderProxy(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGenericTraderProxy(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid genericTraderProxy',
      );
    });
  });

  describe('#ownerSetSlippageToleranceForPauseSentinel', () => {
    it('should work normally', async () => {
      const slippageTolerance = '123';
      const result = await registry.connect(core.governance)
        .ownerSetSlippageToleranceForPauseSentinel(slippageTolerance);
      await expectEvent(registry, result, 'SlippageToleranceForPauseSentinelSet', {
        slippageTolerance,
      });
      expect(await registry.slippageToleranceForPauseSentinel()).to.equal(slippageTolerance);
    });

    it('should fail if slippageToleranceForPauseSentinel is invalid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSlippageToleranceForPauseSentinel(0),
        'DolomiteRegistryImplementation: Invalid slippageTolerance',
      );
      await expectThrow(
        registry.connect(core.governance).ownerSetSlippageToleranceForPauseSentinel('1000000000000000000'),
        'DolomiteRegistryImplementation: Invalid slippageTolerance',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSlippageToleranceForPauseSentinel(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

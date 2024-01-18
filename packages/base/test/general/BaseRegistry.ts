import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { TestBaseRegistry, TestBaseRegistry__factory } from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import { createRegistryProxy } from '../utils/dolomite';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('BaseRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: TestBaseRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    const implementation = await createContractWithAbi<TestBaseRegistry>(
      TestBaseRegistry__factory.abi,
      TestBaseRegistry__factory.bytecode,
      [],
    );
    const registryProxy = await createRegistryProxy(
      implementation.address,
      (await implementation.populateTransaction.initialize(core.dolomiteRegistry.address)).data!,
      core,
    );
    registry = new TestBaseRegistry__factory(core.governance).attach(registryProxy.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetDolomiteRegistry', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteRegistry(
        core.dolomiteRegistry.address,
      );
      await expectEvent(registry, result, 'DolomiteRegistrySet', {
        dolomiteRegistry: core.dolomiteRegistry.address,
      });
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if dolomiteRegistry is invalid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDolomiteRegistry(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDolomiteRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDolomiteRegistry(ZERO_ADDRESS),
        'BaseRegistry: Invalid dolomiteRegistry',
      );
    });
  });
});

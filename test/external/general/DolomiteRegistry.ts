import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createDolomiteRegistryImplementation,
  createRegistryProxy,
} from '../../utils/dolomite';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
} from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteRegistryImplementation', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let implementation: DolomiteRegistryImplementation;
  let registry: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol(
      getDefaultCoreProtocolConfig(Network.ArbitrumOne)
    );
    implementation = await createDolomiteRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(
      core.genericTraderProxy!.address,
      core.expiry!.address
    );
    const registryProxy = await createRegistryProxy(
      implementation.address,
      calldata.data!,
      core
    );
    registry = DolomiteRegistryImplementation__factory.connect(
      registryProxy.address,
      core.governance
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.genericTraderProxy()).to.equal(
        core.genericTraderProxy!.address
      );
      expect(await registry.expiry()).to.equal(core.expiry!.address);
    });

    it('should fail to initialize if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.genericTraderProxy!.address,
          core.expiry!.address
        ),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#ownerSetGenericTraderProxy', () => {
    it('should work normally', async () => {
      const genericTraderProxy = core.genericTraderProxy!.address;
      const result = await registry
        .connect(core.governance)
        .ownerSetGenericTraderProxy(genericTraderProxy);
      await expectEvent(registry, result, 'GenericTraderProxySet', {
        genericTraderProxy,
      });
      expect(await registry.genericTraderProxy()).to.equal(genericTraderProxy);
    });

    it('should fail if genericTraderProxy is invalid', async () => {
      await expectThrow(
        registry
          .connect(core.governance)
          .ownerSetGenericTraderProxy(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry
          .connect(core.hhUser1)
          .ownerSetGenericTraderProxy(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry
          .connect(core.governance)
          .ownerSetGenericTraderProxy(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid genericTraderProxy'
      );
    });
  });

  describe('#ownerSetExpiry', () => {
    it('should work normally', async () => {
      const result = await registry
        .connect(core.governance)
        .ownerSetExpiry(OTHER_ADDRESS);
      await expectEvent(registry, result, 'ExpirySet', {
        OTHER_ADDRESS,
      });
      expect(await registry.expiry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetExpiry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetExpiry(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid expiry'
      );
    });
  });
});

import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '../../src/types';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteRegistryImplementation, createRegistryProxy } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteRegistryImplementation', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let implementation: DolomiteRegistryImplementation;
  let registry: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    implementation = await createDolomiteRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(
      core.genericTraderProxy.address,
      core.expiry.address,
      core.constants.slippageToleranceForPauseSentinel,
      core.liquidatorAssetRegistry.address,
      core.eventEmitterRegistryProxy.address,
      core.dolomiteAccountRegistry.address,
    );
    const registryProxy = await createRegistryProxy(implementation.address, calldata.data!, core);
    registry = DolomiteRegistryImplementation__factory.connect(registryProxy.address, core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.genericTraderProxy()).to.equal(core.genericTraderProxy.address);
      expect(await registry.expiry()).to.equal(core.expiry.address);
      expect(await registry.slippageToleranceForPauseSentinel())
        .to
        .equal(core.constants.slippageToleranceForPauseSentinel);
      expect(await registry.liquidatorAssetRegistry()).to.equal(core.liquidatorAssetRegistry.address);
      expect(await registry.eventEmitter()).to.equal(core.eventEmitterRegistryProxy.address);
    });

    it('should fail to initialize if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.genericTraderProxy.address,
          core.expiry.address,
          core.constants.slippageToleranceForPauseSentinel,
          core.liquidatorAssetRegistry.address,
          core.eventEmitterRegistryProxy.address,
          core.dolomiteAccountRegistry.address,
        ),
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
      const genericTraderProxy = core.genericTraderProxy.address;
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

  describe('#ownerSetExpiry', () => {
    it('should work normally', async () => {
      const expiryAddress = core.expiry.address;
      const result = await registry.connect(core.governance).ownerSetExpiry(expiryAddress);
      await expectEvent(registry, result, 'ExpirySet', {
        expiryAddress,
      });
      expect(await registry.expiry()).to.equal(expiryAddress);
    });

    it('should fail if expiry is not valid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetExpiry(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetExpiry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetExpiry(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid expiry',
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

  describe('#ownerSetLiquidatorAssetRegistry', () => {
    it('should work normally', async () => {
      const liquidatorAssetRegistry = core.liquidatorAssetRegistry.address;
      const result = await registry.connect(core.governance).ownerSetLiquidatorAssetRegistry(liquidatorAssetRegistry);
      await expectEvent(registry, result, 'LiquidatorAssetRegistrySet', {
        liquidatorAssetRegistry,
      });
      expect(await registry.liquidatorAssetRegistry()).to.equal(liquidatorAssetRegistry);
    });

    it('should fail if liquidatorAssetRegistry is invalid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetLiquidatorAssetRegistry(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetLiquidatorAssetRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetLiquidatorAssetRegistry(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid liquidatorAssetRegistry',
      );
    });
  });

  describe('#ownerSetEventEmitter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetEventEmitter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'EventEmitterSet', {
        eventEmitter: OTHER_ADDRESS,
      });
      expect(await registry.eventEmitter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetEventEmitter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetEventEmitter(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid eventEmitter',
      );
    });
  });

  describe('#ownerSetChainlinkPriceOracle', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await expectEvent(registry, result, 'ChainlinkPriceOracleSet', {
        chainlinkPriceOracle: OTHER_ADDRESS,
      });
      expect(await registry.chainlinkPriceOracle()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetChainlinkPriceOracle(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetChainlinkPriceOracle(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid chainlinkPriceOracle',
      );
    });
  });

  describe('#ownerSetDolomiteMigrator', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteMigrator(OTHER_ADDRESS);
      await expectEvent(registry, result, 'DolomiteMigratorSet', {
        dolomiteMigrator: OTHER_ADDRESS,
      });
      expect(await registry.dolomiteMigrator()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDolomiteMigrator(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDolomiteMigrator(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid dolomiteMigrator',
      );
    });
  });

  describe('#ownerSetRedstonePriceOracle', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetRedstonePriceOracle(OTHER_ADDRESS);
      await expectEvent(registry, result, 'RedstonePriceOracleSet', {
        redstonePriceOracle: OTHER_ADDRESS,
      });
      expect(await registry.redstonePriceOracle()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetRedstonePriceOracle(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetRedstonePriceOracle(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid redstonePriceOracle',
      );
    });
  });

  describe('#ownerSetOracleAggregator', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetOracleAggregator(OTHER_ADDRESS);
      await expectEvent(registry, result, 'OracleAggregatorSet', {
        oracleAggregator: OTHER_ADDRESS,
      });
      expect(await registry.oracleAggregator()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetOracleAggregator(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetOracleAggregator(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid oracleAggregator',
      );
    });
  });

  describe('#ownerSetDolomiteAccountRegistry', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteAccountRegistry(OTHER_ADDRESS);
      await expectEvent(registry, result, 'DolomiteAccountRegistrySet', {
        dolomiteAccountRegistry: OTHER_ADDRESS,
      });
      expect(await registry.dolomiteAccountRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDolomiteAccountRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDolomiteAccountRegistry(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid dolomiteAccountRegistry',
      );
    });
  });
});

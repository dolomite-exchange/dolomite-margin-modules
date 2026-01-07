import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '../../src/types';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteRegistryImplementation, createRegistryProxy } from '../utils/dolomite';
import { setupCoreProtocol } from '../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteRegistryImplementation', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let implementation: DolomiteRegistryImplementation;
  let registry: DolomiteRegistryImplementation;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 274_000_000,
      network: Network.ArbitrumOne,
    });
    implementation = await createDolomiteRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(
      core.borrowPositionProxyV2.address,
      core.genericTraderProxy.address,
      core.expiry.address,
      core.constants.slippageToleranceForPauseSentinel,
      core.liquidatorAssetRegistry.address,
      core.eventEmitterRegistryProxy.address,
      core.dolomiteAccountRegistry.address,
      core.gnosisSafeAddress,
      core.governanceAddress,
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
      expect(await registry.slippageToleranceForPauseSentinel()).to.equal(
        core.constants.slippageToleranceForPauseSentinel,
      );
      expect(await registry.liquidatorAssetRegistry()).to.equal(core.liquidatorAssetRegistry.address);
      expect(await registry.eventEmitter()).to.equal(core.eventEmitterRegistryProxy.address);
    });

    it('should fail to initialize if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.borrowPositionProxyV2.address,
          core.genericTraderProxy.address,
          core.expiry.address,
          core.constants.slippageToleranceForPauseSentinel,
          core.liquidatorAssetRegistry.address,
          core.eventEmitterRegistryProxy.address,
          core.dolomiteAccountRegistry.address,
          core.gnosisSafeAddress,
          core.governanceAddress,
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

  describe('#ownerSetBorrowPositionProxy', () => {
    it('should work normally', async () => {
      const borrowPositionProxy = core.borrowPositionProxyV2.address;
      const result = await registry.connect(core.governance).ownerSetBorrowPositionProxy(borrowPositionProxy);
      await expectEvent(registry, result, 'BorrowPositionProxySet', {
        _borrowPositionProxy: borrowPositionProxy,
      });
      expect(await registry.borrowPositionProxy()).to.equal(borrowPositionProxy);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBorrowPositionProxy(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid borrowPositionProxy',
      );
    });
    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBorrowPositionProxy(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetGenericTraderProxy', () => {
    it('should work normally', async () => {
      const genericTraderProxy = core.genericTraderProxy.address;
      const result = await registry.connect(core.governance).ownerSetGenericTraderProxy(genericTraderProxy);
      await expectEvent(registry, result, 'GenericTraderProxySet', {
        _genericTraderProxy: genericTraderProxy,
      });
      expect(await registry.genericTraderProxy()).to.equal(genericTraderProxy);
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
        _expiry: expiryAddress,
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

  describe('#ownerSetFeeAgent', () => {
    it('should work normally', async () => {
      expect(await registry.feeAgent()).to.equal(ZERO_ADDRESS);
      const result = await registry.connect(core.governance).ownerSetFeeAgent(OTHER_ADDRESS);
      await expectEvent(registry, result, 'FeeAgentSet', {
        _feeAgent: OTHER_ADDRESS,
      });
      expect(await registry.feeAgent()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetFeeAgent(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid feeAgent',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetFeeAgent(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetSlippageToleranceForPauseSentinel', () => {
    it('should work normally', async () => {
      const slippageTolerance = '123';
      const result = await registry
        .connect(core.governance)
        .ownerSetSlippageToleranceForPauseSentinel(slippageTolerance);
      await expectEvent(registry, result, 'SlippageToleranceForPauseSentinelSet', {
        _slippageTolerance: slippageTolerance,
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
        _liquidatorAssetRegistry: liquidatorAssetRegistry,
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
        _eventEmitter: OTHER_ADDRESS,
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
        _chainlinkPriceOracle: OTHER_ADDRESS,
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
        _dolomiteMigrator: OTHER_ADDRESS,
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
        _redstonePriceOracle: OTHER_ADDRESS,
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
        _oracleAggregator: OTHER_ADDRESS,
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
        _dolomiteAccountRegistry: OTHER_ADDRESS,
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

  describe('#ownerSetTrustedInternalTraders', () => {
    it('should work normally', async () => {
      const res = await registry.connect(core.governance).ownerSetTrustedInternalTraders(
        [core.hhUser1.address],
        [true]
      );
      await expectEvent(registry, res, 'TrustedInternalTradersSet', {
        _trustedInternalTraders: [core.hhUser1.address],
        _isTrusted: [true],
      });
      expect(await registry.isTrustedInternalTrader(core.hhUser1.address)).to.equal(true);
    });

    it('should fail if the length of the arrays do not match', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetTrustedInternalTraders(
          [core.hhUser1.address],
          []
        ),
        'DolomiteRegistryImplementation: Array length mismatch'
      );
    });

    it('should fail if a zero address is provided', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetTrustedInternalTraders(
          [ZERO_ADDRESS],
          [true]
        ),
        'DolomiteRegistryImplementation: Invalid trustedInternalTrader'
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetTrustedInternalTraders(
          [core.hhUser1.address],
          [true]
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetTreasury', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetTreasury(core.hhUser1.address);
      await expectEvent(registry, result, 'TreasurySet', {
        _treasury: core.hhUser1.address,
      });
      expect(await registry.treasury()).to.equal(core.hhUser1.address);
    });

    it('should fail if zero address is provided', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetTreasury(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid treasury'
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetTreasury(core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetDao', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDao(core.hhUser1.address);
      await expectEvent(registry, result, 'DaoSet', {
        _dao: core.hhUser1.address,
      });
      expect(await registry.dao()).to.equal(core.hhUser1.address);
    });

    it('should fail if zero address is provided', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDao(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid dao'
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDao(core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetIsolationModeMulticallFunctions', () => {
    it('should work normally', async () => {
      const selectors = ['0x12345678', '0x12345679'];

      const result = await registry.connect(core.governance).ownerSetIsolationModeMulticallFunctions(selectors);
      await expectEvent(registry, result, 'IsolationModeMulticallFunctionsSet', {
        _selectors: selectors,
      });
      expect(await registry.isolationModeMulticallFunctions()).to.deep.equal(selectors);

      await registry.connect(core.governance).ownerSetIsolationModeMulticallFunctions([]);
      expect(await registry.isolationModeMulticallFunctions()).to.deep.equal([]);
    });

    it('should pass if zero selectors are provided', async () => {
      const result = await registry.connect(core.governance).ownerSetIsolationModeMulticallFunctions([]);
      await expectEvent(registry, result, 'IsolationModeMulticallFunctionsSet', {
        _selectors: [],
      });
      expect(await registry.isolationModeMulticallFunctions()).to.deep.equal([]);
    });

    it('should fail if duplicate selectors are provided', async () => {
      const selectors = ['0x12345678', '0x12345678'];
      await expectThrow(
        registry.connect(core.governance).ownerSetIsolationModeMulticallFunctions(selectors),
        'DolomiteRegistryImplementation: Selectors not sorted',
      );
    });

    it('should fail if selectors are not sorted', async () => {
      const selectors = ['0x12345679', '0x12345678'];
      await expectThrow(
        registry.connect(core.governance).ownerSetIsolationModeMulticallFunctions(selectors),
        'DolomiteRegistryImplementation: Selectors not sorted',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIsolationModeMulticallFunctions([]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetAdminRegistry', () => {
    it('should work normally', async () => {
      expect(await registry.adminRegistry()).to.equal(ZERO_ADDRESS);
      const result = await registry.connect(core.governance).ownerSetAdminRegistry(OTHER_ADDRESS);
      await expectEvent(registry, result, 'AdminRegistrySet', {
        _adminRegistry: OTHER_ADDRESS,
      });
      expect(await registry.adminRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetAdminRegistry(ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid adminRegistry',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetAdminRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetMarketIdToDToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMarketIdToDToken(
        core.marketIds.usdc,
        core.dolomiteTokens.usdc.address
      );
      await expectEvent(registry, result, 'MarketIdToDTokenSet', {
        _marketId: core.marketIds.usdc,
        _dToken: core.dolomiteTokens.usdc.address,
      });
      expect(await registry.marketIdToDToken(core.marketIds.usdc)).to.equal(core.dolomiteTokens.usdc.address);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMarketIdToDToken(core.marketIds.usdc, ZERO_ADDRESS),
        'DolomiteRegistryImplementation: Invalid dToken',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMarketIdToDToken(core.marketIds.usdc, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

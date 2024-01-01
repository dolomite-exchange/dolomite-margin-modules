import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import {
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  JonesUSDCRegistry,
} from '../../../../src/types';
import { Network } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectEvent, expectThrow } from '../../../utils/assertions';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../utils/setup';

const OTHER_ADDRESS_1 = '0x1234567812345678123456781234567812345671';
const OTHER_ADDRESS_2 = '0x1234567812345678123456781234567812345672';

describe('JonesUSDCRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: JonesUSDCRegistry;
  let unwrapperForLiquidation: JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation;
  let unwrapperForZap: JonesUSDCIsolationModeUnwrapperTraderV2;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createJonesUSDCRegistry(core);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    const factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      registry,
      core.jonesEcosystem!.jUSDC,
      userVaultImplementation,
    );
    unwrapperForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(core, registry, factory);
    unwrapperForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      registry,
      factory,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      await registry.connect(core.hhUser1).initializeUnwrapperTraders(
        unwrapperForLiquidation.address,
        unwrapperForZap.address,
      );
      expect(await registry.glpAdapter()).to.equal(core.jonesEcosystem!.glpAdapter.address);
      expect(await registry.glpVaultRouter()).to.equal(core.jonesEcosystem!.glpVaultRouter.address);
      expect(await registry.whitelistController()).to.equal(core.jonesEcosystem!.whitelistController.address);
      expect(await registry.usdcReceiptToken()).to.equal(core.jonesEcosystem!.usdcReceiptToken.address);
      expect(await registry.jUSDC()).to.equal(core.jonesEcosystem!.jUSDC.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
      expect(await registry.unwrapperTraderForLiquidation()).to.equal(unwrapperForLiquidation.address);
      expect(await registry.unwrapperTraderForZap()).to.equal(unwrapperForZap.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.jonesEcosystem!.glpAdapter.address,
          core.jonesEcosystem!.glpVaultRouter.address,
          core.jonesEcosystem!.whitelistController.address,
          core.jonesEcosystem!.usdcReceiptToken.address,
          core.jonesEcosystem!.jUSDC.address,
          core.jonesEcosystem!.jUSDCFarm.address,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#initializeUnwrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.hhUser1).initializeUnwrapperTraders(
        OTHER_ADDRESS_1,
        OTHER_ADDRESS_2,
      );
      await expectEvent(registry, result, 'UnwrapperTraderForLiquidationSet', {
        unwrapperForLiquidation: OTHER_ADDRESS_1,
      });
      await expectEvent(registry, result, 'UnwrapperTraderForZapSet', {
        unwrapperForZp: OTHER_ADDRESS_2,
      });
      expect(await registry.unwrapperTraderForLiquidation()).to.equal(OTHER_ADDRESS_1);
      expect(await registry.unwrapperTraderForZap()).to.equal(OTHER_ADDRESS_2);
    });

    it('should fail when already initialized', async () => {
      await registry.connect(core.hhUser1).initializeUnwrapperTraders(OTHER_ADDRESS_1, OTHER_ADDRESS_2);
      await expectThrow(
        registry.connect(core.hhUser1).initializeUnwrapperTraders(OTHER_ADDRESS_1, OTHER_ADDRESS_2),
        'JonesUSDCRegistry: Already initialized',
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).initializeUnwrapperTraders(ZERO_ADDRESS, ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid unwrapperTrader address',
      );
    });
  });

  describe('#ownerSetGlpAdapter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpAdapter(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GlpAdapterSet', {
        glpAdapter: OTHER_ADDRESS_1,
      });
      expect(await registry.glpAdapter()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpAdapter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpAdapter(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid glpAdapter address',
      );
    });
  });

  describe('#ownerSetGlpVaultRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpVaultRouter(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GlpVaultRouterSet', {
        glpVaultRouter: OTHER_ADDRESS_1,
      });
      expect(await registry.glpVaultRouter()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpVaultRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpVaultRouter(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid glpVaultRouter address',
      );
    });
  });

  describe('#ownerSetWhitelistController', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetWhitelistController(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'WhitelistControllerSet', {
        whitelistController: OTHER_ADDRESS_1,
      });
      expect(await registry.whitelistController()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetWhitelistController(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetWhitelistController(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid whitelist address',
      );
    });
  });

  describe('#ownerSetUsdcReceiptToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetUsdcReceiptToken(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'UsdcReceiptTokenSet', {
        usdcReceiptToken: OTHER_ADDRESS_1,
      });
      expect(await registry.usdcReceiptToken()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetUsdcReceiptToken(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetUsdcReceiptToken(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid usdcReceiptToken address',
      );
    });
  });

  describe('#ownerSetJUSDC', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetJUSDC(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'JUSDCSet', {
        jUSDC: OTHER_ADDRESS_1,
      });
      expect(await registry.jUSDC()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetJUSDC(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetJUSDC(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid jUSDC address',
      );
    });
  });

  describe('#ownerSetUnwrapperTraderForLiquidation', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetUnwrapperTraderForLiquidation(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'UnwrapperTraderForLiquidationSet', {
        unwrapperTrader: OTHER_ADDRESS_1,
      });
      expect(await registry.unwrapperTraderForLiquidation()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetUnwrapperTraderForLiquidation(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetUnwrapperTraderForLiquidation(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid unwrapperTrader address',
      );
    });
  });

  describe('#ownerSetUnwrapperTraderForZap', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetUnwrapperTraderForZap(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'UnwrapperTraderForZapSet', {
        unwrapperTrader: OTHER_ADDRESS_1,
      });
      expect(await registry.unwrapperTraderForZap()).to.equal(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetUnwrapperTraderForZap(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetUnwrapperTraderForZap(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid unwrapperTrader address',
      );
    });
  });

  describe('#ownerSetDolomiteRegistry', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteRegistry(core.dolomiteRegistry.address);
      await expectEvent(registry, result, 'DolomiteRegistrySet', {
        glpManager: core.dolomiteRegistry.address,
      });
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDolomiteRegistry(OTHER_ADDRESS_1),
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

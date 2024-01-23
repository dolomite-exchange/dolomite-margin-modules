import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { GmxRegistryV1 } from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createGmxRegistry } from './glp-ecosystem-utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GmxRegistryV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: GmxRegistryV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createGmxRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.bnGmx()).to.equal(core.gmxEcosystem!.bnGmx.address);
      expect(await registry.esGmx()).to.equal(core.gmxEcosystem!.esGmx.address);
      expect(await registry.fsGlp()).to.equal(core.gmxEcosystem!.fsGlp.address);
      expect(await registry.glp()).to.equal(core.gmxEcosystem!.glp.address);
      expect(await registry.glpManager()).to.equal(core.gmxEcosystem!.glpManager.address);
      expect(await registry.glpRewardsRouter()).to.equal(core.gmxEcosystem!.glpRewardsRouter.address);
      expect(await registry.gmx()).to.equal(core.gmxEcosystem!.gmx.address);
      expect(await registry.gmxRewardsRouter()).to.equal(core.gmxEcosystem!.gmxRewardsRouterV2.address);
      expect(await registry.gmxVault()).to.equal(core.gmxEcosystem!.gmxVault.address);
      expect(await registry.sGlp()).to.equal(core.gmxEcosystem!.sGlp.address);
      expect(await registry.sGmx()).to.equal(core.gmxEcosystem!.sGmx.address);
      expect(await registry.sbfGmx()).to.equal(core.gmxEcosystem!.sbfGmx.address);
      expect(await registry.vGlp()).to.equal(core.gmxEcosystem!.vGlp.address);
      expect(await registry.vGmx()).to.equal(core.gmxEcosystem!.vGmx.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      const initializer = {
        bnGmx: core.gmxEcosystem!.bnGmx.address,
        esGmx: core.gmxEcosystem!.esGmx.address,
        fsGlp: core.gmxEcosystem!.fsGlp.address,
        glp: core.gmxEcosystem!.glp.address,
        glpManager: core.gmxEcosystem!.glpManager.address,
        glpRewardsRouter: core.gmxEcosystem!.glpRewardsRouter.address,
        gmx: core.gmxEcosystem!.gmx.address,
        gmxRewardsRouter: core.gmxEcosystem!.gmxRewardsRouterV2.address,
        gmxVault: core.gmxEcosystem!.gmxVault.address,
        sGlp: core.gmxEcosystem!.sGlp.address,
        sGmx: core.gmxEcosystem!.sGmx.address,
        sbfGmx: core.gmxEcosystem!.sbfGmx.address,
        vGlp: core.gmxEcosystem!.vGlp.address,
        vGmx: core.gmxEcosystem!.vGmx.address,
      };

      await expectThrow(
        registry.initialize(initializer, core.dolomiteRegistry.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetBnGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBnGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BnGmxSet', {
        bnGmx: OTHER_ADDRESS,
      });
      expect(await registry.bnGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBnGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
      expect(await registry.bnGmx()).to.equal(core.gmxEcosystem!.bnGmx.address);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBnGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid bnGmx address',
      );
    });
  });

  describe('#ownerSetEsGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetEsGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'EsGmxSet', {
        esGmx: OTHER_ADDRESS,
      });
      expect(await registry.esGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetEsGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetEsGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid esGmx address',
      );
    });
  });

  describe('#ownerSetFSGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetFSGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'FSGlpSet', {
        esGmx: OTHER_ADDRESS,
      });
      expect(await registry.fsGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetFSGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetFSGlp(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid fsGlp address',
      );
    });
  });

  describe('#ownerSetGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpSet', {
        glp: OTHER_ADDRESS,
      });
      expect(await registry.glp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlp(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid glp address',
      );
    });
  });

  describe('#ownerSetGlpManager', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpManager(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpManagerSet', {
        glpManager: OTHER_ADDRESS,
      });
      expect(await registry.glpManager()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpManager(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpManager(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid glpManager address',
      );
    });
  });

  describe('#ownerSetGlpRewardsRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpRewardsRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpRewardsRouterSet', {
        glpRewardsRouter: OTHER_ADDRESS,
      });
      expect(await registry.glpRewardsRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpRewardsRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpRewardsRouter(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid glpRewardsRouter address',
      );
    });
  });

  describe('#ownerSetGlpVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpVaultFactorySet', {
        glpVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.glpVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpVaultFactory(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid glpVaultFactory address',
      );
    });
  });

  describe('#ownerSetGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxSet', {
        gmx: OTHER_ADDRESS,
      });
      expect(await registry.gmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid gmx address',
      );
    });
  });

  describe('#ownerSetGmxRewardsRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxRewardsRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxRewardsRouterSet', {
        gmxRewardsRouter: OTHER_ADDRESS,
      });
      expect(await registry.gmxRewardsRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxRewardsRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxRewardsRouter(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid gmxRewardsRouter address',
      );
    });
  });

  describe('#ownerSetGmxVault', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxVault(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxVaultSet', {
        gmxVault: OTHER_ADDRESS,
      });
      expect(await registry.gmxVault()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxVault(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxVault(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid gmxVault address',
      );
    });
  });

  describe('#ownerSetGmxVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxVaultFactorySet', {
        gmxVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.gmxVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxVaultFactory(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid gmxVault address',
      );
    });
  });

  describe('#ownerSetSGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SGlpSet', {
        sGlp: OTHER_ADDRESS,
      });
      expect(await registry.sGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSGlp(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid sGlp address',
      );
    });
  });

  describe('#ownerSetSGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SGmxSet', {
        sGmx: OTHER_ADDRESS,
      });
      expect(await registry.sGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid sGmx address',
      );
    });
  });

  describe('#ownerSetSbfGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSbfGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SbfGmxSet', {
        sbfGmx: OTHER_ADDRESS,
      });
      expect(await registry.sbfGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSbfGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSbfGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid sbfGmx address',
      );
    });
  });

  describe('#ownerSetVGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetVGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'VGlpSet', {
        vGlp: OTHER_ADDRESS,
      });
      expect(await registry.vGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetVGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetVGlp(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid vGlp address',
      );
    });
  });

  describe('#ownerSetVGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetVGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'VGmxSet', {
        vGmx: OTHER_ADDRESS,
      });
      expect(await registry.vGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetVGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetVGmx(ZERO_ADDRESS),
        'GmxRegistryV1: Invalid vGmx address',
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

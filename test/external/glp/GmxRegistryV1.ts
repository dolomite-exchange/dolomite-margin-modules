import { expect } from 'chai';
import { GmxRegistryV1 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';
import { createGmxRegistry } from '../../utils/wrapped-token-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GmxRegistryV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: GmxRegistryV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    registry = await createGmxRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.esGmx()).to.equal(core.gmxEcosystem!.esGmx.address);
      expect(await registry.fsGlp()).to.equal(core.gmxEcosystem!.fsGlp.address);
      expect(await registry.glp()).to.equal(core.gmxEcosystem!.glp.address);
      expect(await registry.glpManager()).to.equal(core.gmxEcosystem!.glpManager.address);
      expect(await registry.glpRewardsRouter()).to.equal(core.gmxEcosystem!.glpRewardsRouter.address);
      expect(await registry.gmx()).to.equal(core.gmxEcosystem!.gmx.address);
      expect(await registry.gmxRewardsRouter()).to.equal(core.gmxEcosystem!.gmxRewardsRouter.address);
      expect(await registry.gmxVault()).to.equal(core.gmxEcosystem!.gmxVault.address);
      expect(await registry.sGlp()).to.equal(core.gmxEcosystem!.sGlp.address);
      expect(await registry.sGmx()).to.equal(core.gmxEcosystem!.sGmx.address);
      expect(await registry.sbfGmx()).to.equal(core.gmxEcosystem!.sbfGmx.address);
      expect(await registry.vGlp()).to.equal(core.gmxEcosystem!.vGlp.address);
      expect(await registry.vGmx()).to.equal(core.gmxEcosystem!.vGmx.address);
    });
  });

  describe('#setEsGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setEsGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'EsGmxSet', {
        esGmx: OTHER_ADDRESS,
      });
      expect(await registry.esGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setEsGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setFSGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setFSGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'FSGlpSet', {
        esGmx: OTHER_ADDRESS,
      });
      expect(await registry.fsGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setFSGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpSet', {
        glp: OTHER_ADDRESS,
      });
      expect(await registry.glp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGlpManager', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGlpManager(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpManagerSet', {
        glpManager: OTHER_ADDRESS,
      });
      expect(await registry.glpManager()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGlpManager(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGlpRewardsRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGlpRewardsRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpRewardsRouterSet', {
        glpRewardsRouter: OTHER_ADDRESS,
      });
      expect(await registry.glpRewardsRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGlpRewardsRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxSet', {
        gmx: OTHER_ADDRESS,
      });
      expect(await registry.gmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGmxRewardsRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGmxRewardsRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxRewardsRouterSet', {
        gmxRewardsRouter: OTHER_ADDRESS,
      });
      expect(await registry.gmxRewardsRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGmxRewardsRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setGmxVault', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setGmxVault(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GmxVaultSet', {
        gmxVault: OTHER_ADDRESS,
      });
      expect(await registry.gmxVault()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setGmxVault(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setSGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setSGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SGlpSet', {
        sGlp: OTHER_ADDRESS,
      });
      expect(await registry.sGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setSGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setSGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setSGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SGmxSet', {
        sGmx: OTHER_ADDRESS,
      });
      expect(await registry.sGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setSGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setSbfGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setSbfGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SbfGmxSet', {
        sbfGmx: OTHER_ADDRESS,
      });
      expect(await registry.sbfGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setSbfGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setVGlp', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setVGlp(OTHER_ADDRESS);
      await expectEvent(registry, result, 'VGlpSet', {
        vGlp: OTHER_ADDRESS,
      });
      expect(await registry.vGlp()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setVGlp(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setVGmx', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).setVGmx(OTHER_ADDRESS);
      await expectEvent(registry, result, 'VGmxSet', {
        vGmx: OTHER_ADDRESS,
      });
      expect(await registry.vGmx()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).setVGmx(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

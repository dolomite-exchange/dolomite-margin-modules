import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { PlutusVaultRegistry } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';
import { createPlutusVaultRegistry } from '../../utils/wrapped-token-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PlutusVaultRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: PlutusVaultRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    registry = await createPlutusVaultRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.plutusToken()).to.equal(core.plutusEcosystem!.plsToken.address);
      expect(await registry.plvGlpToken()).to.equal(core.plutusEcosystem!.plvGlp.address);
      expect(await registry.plvGlpRouter()).to.equal(core.plutusEcosystem!.plvGlpRouter.address);
      expect(await registry.plvGlpFarm()).to.equal(core.plutusEcosystem!.plvGlpFarm.address);
    });
  });

  describe('#ownerSetPlutusToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPlutusToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PlutusTokenSet', {
        plutusToken: OTHER_ADDRESS,
      });
      expect(await registry.plutusToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPlutusToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPlutusToken(ZERO_ADDRESS),
        'PlutusVaultRegistry: Invalid plutusToken address',
      );
    });
  });

  describe('#ownerSetPlvGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPlvGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PlvGlpTokenSet', {
        plvGlpToken: OTHER_ADDRESS,
      });
      expect(await registry.plvGlpToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPlvGlpToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPlvGlpToken(ZERO_ADDRESS),
        'PlutusVaultRegistry: Invalid plvGlpToken address',
      );
    });
  });

  describe('#ownerSetPlvGlpRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPlvGlpRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PlvGlpRouterSet', {
        glp: OTHER_ADDRESS,
      });
      expect(await registry.plvGlpRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPlvGlpRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPlvGlpRouter(ZERO_ADDRESS),
        'PlutusVaultRegistry: Invalid plvGlpRouter address',
      );
    });
  });

  describe('#ownerSetPlvGlpFarm', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPlvGlpFarm(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PlvGlpFarmSet', {
        glpManager: OTHER_ADDRESS,
      });
      expect(await registry.plvGlpFarm()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPlvGlpFarm(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPlvGlpFarm(ZERO_ADDRESS),
        'PlutusVaultRegistry: Invalid plvGlpFarm address',
      );
    });
  });
});

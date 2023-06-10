import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { JonesUSDCRegistry } from '../../../../src/types';
import { Network } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectEvent, expectThrow } from '../../../utils/assertions';
import {
  createJonesUSDCIsolationModeUnwrapperTraderV2,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, setupCoreProtocol } from '../../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('JonesUSDCRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: JonesUSDCRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    const unwrapper = createJonesUSDCIsolationModeUnwrapperTraderV2(core);
    registry = await createJonesUSDCRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.glpAdapter()).to.equal(core.jonesEcosystem!.glpAdapter.address);
      expect(await registry.glpVaultRouter()).to.equal(core.jonesEcosystem!.glpVaultRouter.address);
      expect(await registry.whitelistController()).to.equal(core.jonesEcosystem!.whitelistController.address);
      expect(await registry.jUSDC()).to.equal(core.jonesEcosystem!.jUSDC.address);
      expect(await registry.unwrapperTrader()).to.equal(unwrapper.address);
    });
  });

  describe('#ownerGlpAdapter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerGlpAdapter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpAdapterSet', {
        glpAdapter: OTHER_ADDRESS,
      });
      expect(await registry.glpAdapter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerGlpAdapter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerGlpAdapter(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid plutusToken address',
      );
    });
  });

  describe('#ownerSetGlpVaultRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGlpVaultRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpVaultRouterSet', {
        glpVaultRouter: OTHER_ADDRESS,
      });
      expect(await registry.glpVaultRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGlpVaultRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGlpVaultRouter(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid plvGlpToken address',
      );
    });
  });

  describe('#ownerSetWhitelistController', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetWhitelistController(OTHER_ADDRESS);
      await expectEvent(registry, result, 'WhitelistControllerSet', {
        whitelistController: OTHER_ADDRESS,
      });
      expect(await registry.whitelistController()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetWhitelistController(OTHER_ADDRESS),
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

  describe('#ownerSetJUSDC', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetJUSDC(OTHER_ADDRESS);
      await expectEvent(registry, result, 'JUSDCSet', {
        jUSDC: OTHER_ADDRESS,
      });
      expect(await registry.jUSDC()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetJUSDC(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetJUSDC(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid plvGlpFarm address',
      );
    });
  });

  describe('#ownerSetUnwrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetUnwrapperTrader(OTHER_ADDRESS);
      await expectEvent(registry, result, 'UnwrapperTraderSet', {
        unwrapperTrader: OTHER_ADDRESS,
      });
      expect(await registry.unwrapperTrader()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetUnwrapperTrader(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetUnwrapperTrader(ZERO_ADDRESS),
        'JonesUSDCRegistry: Invalid plvGlpFarm address',
      );
    });
  });
});

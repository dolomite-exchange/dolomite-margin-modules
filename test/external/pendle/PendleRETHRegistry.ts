import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { PendleGLPRegistry, PendleRETHRegistry } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { createPendleGLPRegistry, createPendleRETHRegistry } from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendleRETHRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: PendleRETHRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createPendleRETHRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.pendleRouter()).to.equal(core.pendleEcosystem!.pendleRouter.address);
      expect(await registry.ptRETHMarket()).to.equal(core.pendleEcosystem!.ptRETHMarket.address);
      expect(await registry.ptRETHToken()).to.equal(core.pendleEcosystem!.ptRETHToken.address);
      expect(await registry.ptOracle()).to.equal(core.pendleEcosystem!.ptOracle.address);
      expect(await registry.syRETHToken()).to.equal(core.pendleEcosystem!.syRETHToken.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.pendleEcosystem!.pendleRouter.address,
          core.pendleEcosystem!.ptRETHMarket.address,
          core.pendleEcosystem!.ptRETHToken.address,
          core.pendleEcosystem!.ptOracle.address,
          core.pendleEcosystem!.syRETHToken.address,
          core.dolomiteRegistry.address
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetPendleRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPendleRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PendleRouterSet', {
        pendleRouter: OTHER_ADDRESS,
      });
      expect(await registry.pendleRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPendleRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPendleRouter(ZERO_ADDRESS),
        'PendleRETHRegistry: Invalid pendleRouter address',
      );
    });
  });

  describe('#ownerSetPtRETHMarket', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtRETHMarket(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtRETHMarketSet', {
        ptRETHMarket: OTHER_ADDRESS,
      });
      expect(await registry.ptRETHMarket()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtRETHMarket(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtRETHMarket(ZERO_ADDRESS),
        'PendleRETHRegistry: Invalid ptRETHMarket address',
      );
    });
  });

  describe('#ownerSetPtRETHToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtRETHToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtRETHTokenSet', {
        ptRETHToken: OTHER_ADDRESS,
      });
      expect(await registry.ptRETHToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtRETHToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtRETHToken(ZERO_ADDRESS),
        'PendleRETHRegistry: Invalid ptRETHToken address',
      );
    });
  });

  describe('#ownerSetPtOracle', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtOracle(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtOracleSet', {
        ptOracle: OTHER_ADDRESS,
      });
      expect(await registry.ptOracle()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtOracle(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtOracle(ZERO_ADDRESS),
        'PendleRETHRegistry: Invalid ptOracle address',
      );
    });
  });

  describe('#ownerSetSyRETHToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSyRETHToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SyRETHTokenSet', {
        syRETHToken: OTHER_ADDRESS,
      });
      expect(await registry.syRETHToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSyRETHToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSyRETHToken(ZERO_ADDRESS),
        'PendleRETHRegistry: Invalid syRETHToken address',
      );
    });
  });

  describe('#ownerSetDolomiteRegistry', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteRegistry(core.dolomiteRegistry.address);
      await expectEvent(registry, result, 'DolomiteRegistrySet', {
        dolomiteRegistry: core.dolomiteRegistry.address,
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

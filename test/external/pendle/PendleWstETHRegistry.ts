import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { PendleWstETHRegistry } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { createPendleWstETHRegistry } from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendleWstETHRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: PendleWstETHRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createPendleWstETHRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.pendleRouter()).to.equal(core.pendleEcosystem!.pendleRouter.address);
      expect(await registry.ptWstEth2024Market()).to.equal(core.pendleEcosystem!.ptWstEth2024Market.address);
      expect(await registry.ptWstEth2024Token()).to.equal(core.pendleEcosystem!.ptWstEth2024Token.address);
      expect(await registry.ptWstEth2025Market()).to.equal(core.pendleEcosystem!.ptWstEth2025Market.address);
      expect(await registry.ptWstEth2025Token()).to.equal(core.pendleEcosystem!.ptWstEth2025Token.address);
      expect(await registry.ptOracle()).to.equal(core.pendleEcosystem!.ptOracle.address);
      expect(await registry.syWstEthToken()).to.equal(core.pendleEcosystem!.syWstEthToken.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.pendleEcosystem!.pendleRouter.address,
          core.pendleEcosystem!.ptWstEth2024Market.address,
          core.pendleEcosystem!.ptWstEth2024Token.address,
          core.pendleEcosystem!.ptWstEth2025Market.address,
          core.pendleEcosystem!.ptWstEth2025Token.address,
          core.pendleEcosystem!.ptOracle.address,
          core.pendleEcosystem!.syWstEthToken.address,
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
        'PendleWstETHRegistry: Invalid pendleRouter address',
      );
    });
  });

  describe('#ownerSetPtWstEth2024Market', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtWstEth2024Market(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtWstEth2024MarketSet', {
        ptWstEth2024Market: OTHER_ADDRESS,
      });
      expect(await registry.ptWstEth2024Market()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtWstEth2024Market(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtWstEth2024Market(ZERO_ADDRESS),
        'PendleWstETHRegistry: Invalid ptWstEthMarket address',
      );
    });
  });

  describe('#ownerSetPtWstEth2024Token', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtWstEth2024Token(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtWstEth2024TokenSet', {
        ptWstEth2024Token: OTHER_ADDRESS,
      });
      expect(await registry.ptWstEth2024Token()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtWstEth2024Token(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtWstEth2024Token(ZERO_ADDRESS),
        'PendleWstETHRegistry: Invalid ptWstEthToken address',
      );
    });
  });

  describe('#ownerSetPtWstEth2025Market', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtWstEth2025Market(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtWstEth2025MarketSet', {
        ptWstEth2025Market: OTHER_ADDRESS,
      });
      expect(await registry.ptWstEth2025Market()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtWstEth2025Market(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtWstEth2025Market(ZERO_ADDRESS),
        'PendleWstETHRegistry: Invalid ptWstEthMarket address',
      );
    });
  });

  describe('#ownerSetPtWstEth2025Token', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtWstEth2025Token(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtWstEth2025TokenSet', {
        ptWstEth2025Token: OTHER_ADDRESS,
      });
      expect(await registry.ptWstEth2025Token()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtWstEth2025Token(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtWstEth2025Token(ZERO_ADDRESS),
        'PendleWstETHRegistry: Invalid ptWstEthToken address',
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
        'PendleWstETHRegistry: Invalid ptOracle address',
      );
    });
  });

  describe('#ownerSetSyWstEthToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSyWstEthToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SyWstEthTokenSet', {
        syWstEthToken: OTHER_ADDRESS,
      });
      expect(await registry.syWstEthToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSyWstEthToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSyWstEthToken(ZERO_ADDRESS),
        'PendleWstETHRegistry: Invalid syWstEthToken address',
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

import { expect } from 'chai';
import { GmxRegistryV2 } from 'src/types';
import { createGmxRegistryV2 } from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';
import { Network } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const OTHER_ADDRESS_1 = '0x1234567812345678123456781234567812345671';
const OTHER_ADDRESS_2 = '0x1234567812345678123456781234567812345672';

describe('GmxRegistryV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: GmxRegistryV2;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createGmxRegistryV2(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.gmxExchangeRouter()).to.eq(core.gmxEcosystemV2!.gmxExchangeRouter.address);
      expect(await registry.gmxDataStore()).to.eq(core.gmxEcosystemV2!.gmxDataStore.address);
      expect(await registry.gmxReader()).to.eq(core.gmxEcosystemV2!.gmxReader.address);
      expect(await registry.gmxRouter()).to.eq(core.gmxEcosystemV2!.gmxRouter.address);
      expect(await registry.ethUsdMarketToken()).to.eq(core.gmxEcosystemV2!.gmxEthUsdMarketToken.address);
      expect(await registry.gmxDepositHandler()).to.eq(core.gmxEcosystemV2!.gmxDepositHandler.address);
      expect(await registry.gmxDepositVault()).to.eq(core.gmxEcosystemV2!.gmxDepositVault.address);
      expect(await registry.gmxWithdrawalHandler()).to.eq(core.gmxEcosystemV2!.gmxWithdrawalHandler.address);
      expect(await registry.gmxV2UnwrapperTrader()).to.eq(ZERO_ADDRESS);
      expect(await registry.gmxV2WrapperTrader()).to.eq(ZERO_ADDRESS);
      expect(await registry.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
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
        'GmxRegistryV2: Already initialized',
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).initializeUnwrapperTraders(ZERO_ADDRESS, ZERO_ADDRESS),
        'GmxRegistryV2: Invalid unwrapperTrader address',
      );
    });
  });

  describe('#ownerSetGmxExchangeRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxExchangeRouterSet', {
        gmxExchangeRouter: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxExchangeRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxExchangeRouter(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxDataStore', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxDataStore(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxDataStoreSet', {
        gmxDataStore: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxDataStore()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxDataStore(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxDataStore(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxReader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxReader(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxReaderSet', {
        gmxReader: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxReader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxReader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxReader(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxRouter(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxRouterSet', {
        gmxRouter: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxRouter(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxDepositHandler', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxDepositHandler(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxDepositHandlerSet', {
        gmxDepositHandler: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxDepositHandler()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxDepositHandler(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxDepositHandler(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxDepositVault', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxDepositVault(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxDepositVaultSet', {
        gmxDepositVault: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxDepositVault()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxDepositVault(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxDepositVault(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxWithdrawalHandler', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxWithdrawalHandler(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxWithdrawalHandlerSet', {
        gmxWithdrawalHandler: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxWithdrawalHandler()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxWithdrawalHandler(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxWithdrawalHandler(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxV2UnwrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxV2UnwrapperTrader(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxV2UnwrapperTraderSet', {
        gmxV2UnwrapperTrader: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxV2UnwrapperTrader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxV2UnwrapperTrader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxV2UnwrapperTrader(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetGmxV2WrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGmxV2WrapperTrader(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'GmxV2WrapperTraderSet', {
        gmxV2WrapperTrader: OTHER_ADDRESS_1,
      });
      expect(await registry.gmxV2WrapperTrader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGmxV2WrapperTrader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGmxV2WrapperTrader(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });

  describe('#ownerSetEthUsdMarketToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetEthUsdMarketToken(OTHER_ADDRESS_1);
      await expectEvent(registry, result, 'EthUsdMarketTokenSet', {
        ethUsdMarketToken: OTHER_ADDRESS_1,
      });
      expect(await registry.ethUsdMarketToken()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetEthUsdMarketToken(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetEthUsdMarketToken(ZERO_ADDRESS),
        'GmxRegistryV2: Invalid address'
      );
    });
  });
});

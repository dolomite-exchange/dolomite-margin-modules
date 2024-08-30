import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupTestMarket,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE_FOR_TESTS } from '../src/gmx-v2-constructors';
import {
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Library,
  GmxV2Registry,
  TestGmxV2IsolationModeTokenVaultV1,
} from '../src/types';
import {
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2Registry,
  createTestGmxV2IsolationModeTokenVaultV1,
} from './gmx-v2-ecosystem-utils';

const OTHER_ADDRESS_1 = '0x1234567812345678123456781234567812345671';

describe('GmxV2Registry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxV2Registry: GmxV2Registry;
  let gmxV2Library: GmxV2Library;
  let userVaultImplementation: TestGmxV2IsolationModeTokenVaultV1;
  let factory: GmxV2IsolationModeVaultFactory;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;

  let allowableMarketIds: BigNumberish[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);

    gmxV2Library = await createGmxV2Library();
    userVaultImplementation = await createTestGmxV2IsolationModeTokenVaultV1(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxV2Library,
      gmxV2Registry,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxV2Ecosystem!.gmTokens.ethUsd,
      userVaultImplementation,
      GMX_V2_EXECUTION_FEE_FOR_TESTS,
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    await setupTestMarket(core, factory, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await gmxV2Registry.gmxExchangeRouter()).to.eq(core.gmxV2Ecosystem!.gmxExchangeRouter.address);
      expect(await gmxV2Registry.gmxDataStore()).to.eq(core.gmxV2Ecosystem!.gmxDataStore.address);
      expect(await gmxV2Registry.gmxReader()).to.eq(core.gmxV2Ecosystem!.gmxReader.address);
      expect(await gmxV2Registry.gmxRouter()).to.eq(core.gmxV2Ecosystem!.gmxRouter.address);
      expect(await gmxV2Registry.gmxDepositHandler()).to.eq(core.gmxV2Ecosystem!.gmxDepositHandler.address);
      expect(await gmxV2Registry.gmxDepositVault()).to.eq(core.gmxV2Ecosystem!.gmxDepositVault.address);
      expect(await gmxV2Registry.gmxWithdrawalHandler()).to.eq(core.gmxV2Ecosystem!.gmxWithdrawalHandler.address);
      expect(await gmxV2Registry.gmxWithdrawalVault()).to.eq(core.gmxV2Ecosystem!.gmxWithdrawalVault.address);
      expect(await gmxV2Registry.getUnwrapperByToken(core.tokens.weth.address)).to.eq(ZERO_ADDRESS);
      expect(await gmxV2Registry.getWrapperByToken(core.tokens.weth.address)).to.eq(ZERO_ADDRESS);
      expect(await gmxV2Registry.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await gmxV2Registry.callbackGasLimit()).to.eq(GMX_V2_CALLBACK_GAS_LIMIT);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        gmxV2Registry.initialize(
          core.gmxV2Ecosystem!.gmxDataStore.address,
          core.gmxV2Ecosystem!.gmxDepositVault.address,
          core.gmxV2Ecosystem!.gmxExchangeRouter.address,
          core.gmxV2Ecosystem!.gmxReader.address,
          core.gmxV2Ecosystem!.gmxRouter.address,
          core.gmxV2Ecosystem!.gmxWithdrawalVault.address,
          GMX_V2_CALLBACK_GAS_LIMIT,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetUnwrapperByToken', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(
        factory.address,
        unwrapper.address,
      );
      await expectEvent(gmxV2Registry, result, 'UnwrapperTraderSet', {
        factory: factory.address,
        unwrapper: unwrapper.address,
      });
      expect(await gmxV2Registry.getUnwrapperByToken(factory.address)).to.equal(unwrapper.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetUnwrapperByToken(factory.address, unwrapper.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when factory is invalid', async () => {
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        gmxV2Registry,
        allowableMarketIds,
        allowableMarketIds,
        core.gmxV2Ecosystem!.gmTokens.ethUsd,
        userVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS,
      );
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(
          factory.address,
          unwrapper.address,
        ),
        'HandlerRegistry: Invalid factory token',
      );
    });

    it('should fail if unwrapper is invalid', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(
          core.tokens.dfsGlp!.address,
          unwrapper.address,
        ),
        'HandlerRegistry: Invalid unwrapper trader',
      );
    });
  });

  describe('#ownerSetWrapperByToken', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(
        factory.address,
        wrapper.address,
      );
      await expectEvent(gmxV2Registry, result, 'WrapperTraderSet', {
        factory: factory.address,
        wrapper: wrapper.address,
      });
      expect(await gmxV2Registry.getWrapperByToken(factory.address)).to.equal(wrapper.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetWrapperByToken(factory.address, wrapper.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when factory is invalid', async () => {
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        gmxV2Registry,
        allowableMarketIds,
        allowableMarketIds,
        core.gmxV2Ecosystem!.gmTokens.ethUsd,
        userVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS,
      );
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(
          factory.address,
          wrapper.address,
        ),
        'HandlerRegistry: Invalid factory token',
      );
    });

    it('should fail if wrapper is invalid', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(
          core.tokens.dfsGlp!.address,
          wrapper.address,
        ),
        'HandlerRegistry: Invalid wrapper trader',
      );
    });
  });

  describe('#ownerSetGmxExchangeRouter', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxExchangeRouterSet', {
        gmxExchangeRouter: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxExchangeRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxExchangeRouter(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxDataStore', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxDataStore(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxDataStoreSet', {
        gmxDataStore: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxDataStore()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxDataStore(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxDataStore(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxReader', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxReader(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxReaderSet', {
        gmxReader: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxReader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxReader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxReader(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxRouter', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxRouter(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxRouterSet', {
        gmxRouter: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxRouter(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxDepositVault', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxDepositVault(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxDepositVaultSet', {
        gmxDepositVault: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxDepositVault()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxDepositVault(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxDepositVault(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxWithdrawalVault', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxWithdrawalVault(OTHER_ADDRESS_1);
      await expectEvent(gmxV2Registry, result, 'GmxWithdrawalVaultSet', {
        gmxWithdrawalVault: OTHER_ADDRESS_1,
      });
      expect(await gmxV2Registry.gmxWithdrawalVault()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxWithdrawalVault(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.governance).ownerSetGmxWithdrawalVault(ZERO_ADDRESS),
        'GmxV2Registry: Invalid address',
      );
    });
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      const result = await gmxV2Registry.connect(core.governance).ownerSetIsHandler(
        core.gmxV2Ecosystem!.gmxDepositHandler.address,
        true,
      );
      await expectEvent(gmxV2Registry, result, 'HandlerSet', {
        handler: core.gmxV2Ecosystem!.gmxDepositHandler.address,
        isTrusted: true,
      });

      expect(await gmxV2Registry.isHandler(core.gmxV2Ecosystem!.gmxDepositHandler.address)).to.eq(true);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetIsHandler(core.gmxV2Ecosystem!.gmxDepositHandler.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetCallbackGasLimit', () => {
    it('should work normally', async () => {
      await gmxV2Registry.connect(core.governance).ownerSetCallbackGasLimit(GMX_V2_CALLBACK_GAS_LIMIT.add(1));
      expect(await gmxV2Registry.callbackGasLimit()).to.eq(GMX_V2_CALLBACK_GAS_LIMIT.add(1));
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetCallbackGasLimit(ZERO_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetGmxMarketToIndexToken', () => {
    it('should work normally', async () => {
      const marketTokenAddress = core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address;
      expect(await gmxV2Registry.gmxMarketToIndexToken(marketTokenAddress)).to.eq(ZERO_ADDRESS);

      const result = await gmxV2Registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        marketTokenAddress,
        OTHER_ADDRESS_1
      );
      await expectEvent(gmxV2Registry, result, 'GmxMarketToIndexTokenSet', {
        marketToken: marketTokenAddress,
        indexToken: OTHER_ADDRESS_1
      });
      expect(await gmxV2Registry.gmxMarketToIndexToken(marketTokenAddress)).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail if not called by dolomite owner', async () => {
      await expectThrow(
        gmxV2Registry.connect(core.hhUser1).ownerSetGmxMarketToIndexToken(
          core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address,
          OTHER_ADDRESS_1
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

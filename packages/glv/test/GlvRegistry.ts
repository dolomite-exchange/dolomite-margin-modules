import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import {
  getDefaultProtocolConfigForGlv,
  setupCoreProtocol,
  setupTestMarket,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvLibrary,
  GlvRegistry,
  GmxV2Library,
  IGlvToken,
  TestGlvIsolationModeTokenVaultV1
} from '../src/types';
import {
  GLV_CALLBACK_GAS_LIMIT,
  GLV_EXECUTION_FEE_FOR_TESTS,
} from 'packages/gmx-v2/src/gmx-v2-constructors';
import {
  createGlvIsolationModeUnwrapperTraderV2,
  createGlvIsolationModeVaultFactory,
  createGlvIsolationModeWrapperTraderV2,
  createGlvLibrary,
  createGlvRegistry,
  createTestGlvIsolationModeTokenVaultV1
} from './glv-ecosystem-utils';
import { createGmxV2Library } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';

const OTHER_ADDRESS_1 = '0x1234567812345678123456781234567812345671';

describe('GlvRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glvRegistry: GlvRegistry;
  let glvLibrary: GlvLibrary;
  let gmxV2Library: GmxV2Library;
  let userVaultImplementation: TestGlvIsolationModeTokenVaultV1;
  let factory: GlvIsolationModeVaultFactory;
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let underlyingToken: IGlvToken;
  let gmToken: IGmxMarketToken;

  let allowableMarketIds: BigNumberish[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultProtocolConfigForGlv());

    underlyingToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken;
    gmToken = core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken;
    glvRegistry = await createGlvRegistry(core, GLV_CALLBACK_GAS_LIMIT);

    glvLibrary = await createGlvLibrary();
    gmxV2Library = await createGmxV2Library();
    userVaultImplementation = await createTestGlvIsolationModeTokenVaultV1(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem!.glvTokens.wethUsdc,
      userVaultImplementation,
      GLV_EXECUTION_FEE_FOR_TESTS,
    );
    unwrapper = await createGlvIsolationModeUnwrapperTraderV2(
      core,
      factory,
      glvLibrary,
      gmxV2Library,
      glvRegistry,
    );
    wrapper = await createGlvIsolationModeWrapperTraderV2(
      core,
      factory,
      glvLibrary,
      gmxV2Library,
      glvRegistry,
    );
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await glvRegistry.gmxDataStore()).to.eq(core.gmxV2Ecosystem!.gmxDataStore.address);
      expect(await glvRegistry.gmxExchangeRouter()).to.eq(core.gmxV2Ecosystem!.gmxExchangeRouter.address);
      expect(await glvRegistry.gmxReader()).to.eq(core.gmxV2Ecosystem!.gmxReader.address);
      expect(await glvRegistry.glvHandler()).to.eq(core.glvEcosystem!.glvHandler.address);
      expect(await glvRegistry.glvReader()).to.eq(core.glvEcosystem!.glvReader.address);
      expect(await glvRegistry.glvRouter()).to.eq(core.glvEcosystem!.glvRouter.address);
      expect(await glvRegistry.glvVault()).to.eq(core.glvEcosystem!.glvVault.address);
      expect(await glvRegistry.getUnwrapperByToken(core.tokens.weth.address)).to.eq(ZERO_ADDRESS);
      expect(await glvRegistry.getWrapperByToken(core.tokens.weth.address)).to.eq(ZERO_ADDRESS);
      expect(await glvRegistry.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await glvRegistry.callbackGasLimit()).to.eq(GLV_CALLBACK_GAS_LIMIT);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        glvRegistry.initialize(
          core.gmxV2Ecosystem!.gmxDataStore.address,
          core.gmxV2Ecosystem!.gmxExchangeRouter.address,
          core.gmxV2Ecosystem!.gmxReader.address,
          core.glvEcosystem!.glvHandler.address,
          core.glvEcosystem!.glvReader.address,
          core.glvEcosystem!.glvRouter.address,
          core.glvEcosystem!.glvVault.address,
          GLV_CALLBACK_GAS_LIMIT,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetUnwrapperByToken', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(
        factory.address,
        unwrapper.address,
      );
      await expectEvent(glvRegistry, result, 'UnwrapperTraderSet', {
        factory: factory.address,
        unwrapper: unwrapper.address,
      });
      expect(await glvRegistry.getUnwrapperByToken(factory.address)).to.equal(unwrapper.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetUnwrapperByToken(factory.address, unwrapper.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when factory is invalid', async () => {
      const factory = await createGlvIsolationModeVaultFactory(
        core,
        gmxV2Library,
        glvRegistry,
        allowableMarketIds,
        allowableMarketIds,
        core.glvEcosystem!.glvTokens.wethUsdc,
        userVaultImplementation,
        GLV_EXECUTION_FEE_FOR_TESTS,
      );
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(
          factory.address,
          unwrapper.address,
        ),
        'HandlerRegistry: Invalid factory token',
      );
    });

    it('should fail if unwrapper is invalid', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(
          core.tokens.dfsGlp!.address,
          unwrapper.address,
        ),
        'HandlerRegistry: Invalid unwrapper trader',
      );
    });
  });

  describe('#ownerSetWrapperByToken', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetWrapperByToken(
        factory.address,
        wrapper.address,
      );
      await expectEvent(glvRegistry, result, 'WrapperTraderSet', {
        factory: factory.address,
        wrapper: wrapper.address,
      });
      expect(await glvRegistry.getWrapperByToken(factory.address)).to.equal(wrapper.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetWrapperByToken(factory.address, wrapper.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when factory is invalid', async () => {
      const factory = await createGlvIsolationModeVaultFactory(
        core,
        gmxV2Library,
        glvRegistry,
        allowableMarketIds,
        allowableMarketIds,
        core.glvEcosystem!.glvTokens.wethUsdc,
        userVaultImplementation,
        GLV_EXECUTION_FEE_FOR_TESTS,
      );
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetWrapperByToken(
          factory.address,
          wrapper.address,
        ),
        'HandlerRegistry: Invalid factory token',
      );
    });

    it('should fail if wrapper is invalid', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetWrapperByToken(
          core.tokens.dfsGlp!.address,
          wrapper.address,
        ),
        'HandlerRegistry: Invalid wrapper trader',
      );
    });
  });

  describe('#ownerSetGmxExchangeRouter', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GmxExchangeRouterSet', {
        gmxExchangeRouter: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.gmxExchangeRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGmxExchangeRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGmxExchangeRouter(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxDataStore', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGmxDataStore(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GmxDataStoreSet', {
        gmxDataStore: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.gmxDataStore()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGmxDataStore(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGmxDataStore(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGmxReader', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGmxReader(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GmxReaderSet', {
        gmxReader: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.gmxReader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGmxReader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGmxReader(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGlvHandler', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGlvHandler(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GlvHandlerSet', {
        glvHandler: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.glvHandler()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGlvHandler(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvHandler(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGlvReader', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGlvReader(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GlvReaderSet', {
        glvReader: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.glvReader()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGlvReader(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvReader(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGlvRouter', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGlvRouter(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GlvRouterSet', {
        glvRouter: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.glvRouter()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGlvRouter(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvRouter(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGlvVault', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGlvVault(OTHER_ADDRESS_1);
      await expectEvent(glvRegistry, result, 'GlvVaultSet', {
        glvVault: OTHER_ADDRESS_1,
      });
      expect(await glvRegistry.glvVault()).to.eq(OTHER_ADDRESS_1);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGlvVault(OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvVault(ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetGlvTokenToGmMarket', () => {
    it('should work normally', async () => {
      const result = await glvRegistry.connect(core.governance).ownerSetGlvTokenToGmMarket(
        underlyingToken.address,
        gmToken.address
      );
      await expectEvent(glvRegistry, result, 'GlvTokenToGmMarketSet', {
        glvToken: underlyingToken.address,
        gmMarket: gmToken.address,
      });
      expect(await glvRegistry.glvTokenToGmMarket(underlyingToken.address)).to.eq(gmToken.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetGlvTokenToGmMarket(underlyingToken.address, OTHER_ADDRESS_1),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvTokenToGmMarket(underlyingToken.address, ZERO_ADDRESS),
        'GlvRegistry: Invalid address',
      );
      await expectThrow(
        glvRegistry.connect(core.governance).ownerSetGlvTokenToGmMarket(ZERO_ADDRESS, gmToken.address),
        'GlvRegistry: Invalid address',
      );
    });
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      expect(await glvRegistry.isHandler(core.glvEcosystem.glvHandler.address)).to.eq(true);
      const result = await glvRegistry.connect(core.governance).ownerSetIsHandler(
        core.gmxV2Ecosystem!.gmxDepositHandler.address,
        true,
      );
      await expectEvent(glvRegistry, result, 'HandlerSet', {
        handler: core.gmxV2Ecosystem!.gmxDepositHandler.address,
        isTrusted: true,
      });

      expect(await glvRegistry.isHandler(core.gmxV2Ecosystem!.gmxDepositHandler.address)).to.eq(true);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetIsHandler(core.gmxV2Ecosystem!.gmxDepositHandler.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetCallbackGasLimit', () => {
    it('should work normally', async () => {
      await glvRegistry.connect(core.governance).ownerSetCallbackGasLimit(GLV_CALLBACK_GAS_LIMIT.add(1));
      expect(await glvRegistry.callbackGasLimit()).to.eq(GLV_CALLBACK_GAS_LIMIT.add(1));
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        glvRegistry.connect(core.hhUser1).ownerSetCallbackGasLimit(ZERO_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

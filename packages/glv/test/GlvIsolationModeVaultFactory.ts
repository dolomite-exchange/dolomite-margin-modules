import { expect } from 'chai';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectArrayEq, expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import {
  getDefaultProtocolConfigForGlv,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvLibrary,
  GlvRegistry
} from '../src/types';
import {
  createGlvIsolationModeTokenVaultV1,
  createGlvIsolationModeUnwrapperTraderV2,
  createGlvIsolationModeVaultFactory,
  createGlvIsolationModeWrapperTraderV2,
  createGlvLibrary,
  createGlvRegistry
} from './glv-ecosystem-utils';
import { GLV_CALLBACK_GAS_LIMIT, GLV_EXECUTION_FEE_FOR_TESTS, GMX_V2_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { createGmxV2Library } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { GmxV2Library } from 'packages/gmx-v2/src/types';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const amountWei = parseEther('1');
const defaultAccountNumber = 0;

describe('GlvIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glvRegistry: GlvRegistry;
  let glvLibrary: GlvLibrary;
  let gmxV2Library: GmxV2Library;
  let allowableMarketIds: BigNumberish[];
  let vaultImplementation: GlvIsolationModeTokenVaultV1;
  let factory: GlvIsolationModeVaultFactory;
  let wrapper: GlvIsolationModeWrapperTraderV2;
  let unwrapper: GlvIsolationModeUnwrapperTraderV2;
  let vault: GlvIsolationModeTokenVaultV1;
  let impersonatedWrapper: Signer;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultProtocolConfigForGlv());
    glvRegistry = await createGlvRegistry(
      core,
      core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken,
      GLV_CALLBACK_GAS_LIMIT
    );
    glvLibrary = await createGlvLibrary();
    gmxV2Library = await createGmxV2Library();
    vaultImplementation = await createGlvIsolationModeTokenVaultV1(core, glvLibrary, gmxV2Library);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGlvIsolationModeVaultFactory(
      core,
      gmxV2Library,
      glvRegistry,
      allowableMarketIds,
      allowableMarketIds,
      core.glvEcosystem!.glvTokens.wethUsdc,
      vaultImplementation,
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
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await glvRegistry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await glvRegistry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GlvIsolationModeTokenVaultV1>(
      vaultAddress,
      GlvIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    impersonatedWrapper = await impersonate(wrapper.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.glvRegistry()).to.equal(glvRegistry.address);
      expect(await factory.SHORT_TOKEN()).to.equal(core.tokens.nativeUsdc!.address);
      expect(await factory.LONG_TOKEN()).to.equal(core.tokens.weth.address);
      expectArrayEq(await factory.allowableDebtMarketIds(), [core.marketIds.nativeUsdc!, core.marketIds.weth]);
      expectArrayEq(
        await factory.allowableCollateralMarketIds(),
        [core.marketIds.nativeUsdc!, core.marketIds.weth, marketId],
      );
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.glvEcosystem.glvTokens.wethUsdc.glvToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });

    it('should construct if skipLongToken is true', async () => {
      await createGlvIsolationModeVaultFactory(
        core,
        gmxV2Library,
        glvRegistry,
        allowableMarketIds,
        allowableMarketIds,
        core.glvEcosystem!.glvTokens.wethUsdc,
        vaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS,
        true
      );
    });

    it('should construct if allowable market IDs is in either order', async () => {
      await createGlvIsolationModeVaultFactory(
        core,
        gmxV2Library,
        glvRegistry,
        allowableMarketIds,
        allowableMarketIds,
        core.glvEcosystem!.glvTokens.wethUsdc,
        vaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS,
      );
      await createGlvIsolationModeVaultFactory(
        core,
        gmxV2Library,
        glvRegistry,
        [allowableMarketIds[1], allowableMarketIds[0]],
        [allowableMarketIds[1], allowableMarketIds[0]],
        core.glvEcosystem!.glvTokens.wethUsdc,
        vaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS,
      );
    });

    it('should fail if allowable debt market IDs does not have length of 2', async () => {
      const badAllowableDebtMarketIds = [1];
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          badAllowableDebtMarketIds,
          allowableMarketIds,
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs length',
      );
    });

    it('should fail if allowable debt market IDs has an invalid market ID', async () => {
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          [core.marketIds.nativeUsdc!, core.marketIds.dai!],
          allowableMarketIds,
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs',
      );
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          [core.marketIds.dai!, core.marketIds.nativeUsdc!],
          allowableMarketIds,
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs',
      );
    });

    it('should fail if allowable collateral market IDs does not have length of 2', async () => {
      const badAllowableCollateralMarketIds = [1];
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          allowableMarketIds,
          badAllowableCollateralMarketIds,
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs length',
      );
    });

    it('should fail if allowable collateral market IDs has an invalid market ID', async () => {
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          allowableMarketIds,
          [core.marketIds.nativeUsdc!, core.marketIds.dai!],
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs',
      );
      await expectThrow(
        createGlvIsolationModeVaultFactory(
          core,
          gmxV2Library,
          glvRegistry,
          allowableMarketIds,
          [core.marketIds.dai!, core.marketIds.nativeUsdc!],
          core.glvEcosystem!.glvTokens.wethUsdc,
          vaultImplementation,
          GMX_V2_EXECUTION_FEE_FOR_TESTS,
        ),
        'GmxV2Library: Invalid market IDs',
      );
    });
  });

  describe('#ownerSetHandlerRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetHandlerRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'HandlerRegistrySet', {
        handlerRegistry: OTHER_ADDRESS,
      });
      expect(await factory.handlerRegistry()).to.eq(OTHER_ADDRESS);
      expect(await factory.glvRegistry()).to.eq(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetHandlerRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetExecutionFee', () => {
    const newExecutionFee = parseEther('0.1');
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetExecutionFee(newExecutionFee);
      await expectEvent(factory, result, 'ExecutionFeeSet', {
        executionFee: newExecutionFee,
      });
      expect(await factory.executionFee()).to.eq(newExecutionFee);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetExecutionFee(newExecutionFee),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when execution fee is too large', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerSetExecutionFee(parseEther('1.01')),
        'FreezableVaultFactory: Invalid execution fee',
      );
    });
  });

  describe('#ownerSetMaxExecutionFee', () => {
    const newMaxExecutionFee = parseEther('0.1');
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetMaxExecutionFee(newMaxExecutionFee);
      await expectEvent(factory, result, 'MaxExecutionFeeSet', {
        maxExecutionFee: newMaxExecutionFee,
      });
      expect(await factory.maxExecutionFee()).to.eq(newMaxExecutionFee);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetMaxExecutionFee(newMaxExecutionFee),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#depositIntoDolomiteMarginFromTokenConverter', () => {
    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).depositIntoDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          amountWei,
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositIntoDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          amountWei,
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setIsVaultDepositSourceWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await factory.connect(impersonatedWrapper).setIsVaultDepositSourceWrapper(vault.address, true);
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setIsVaultDepositSourceWrapper(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setIsVaultDepositSourceWrapper(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldVaultSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      await factory.connect(impersonatedWrapper).setShouldVaultSkipTransfer(vault.address, true);
      expect(await vault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setShouldVaultSkipTransfer(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setShouldVaultSkipTransfer(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

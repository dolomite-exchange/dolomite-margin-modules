import { expect } from 'chai';
import { BigNumber, BigNumberish, Contract, Signer } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Library,
} from 'src/types';
import { ZERO_BI } from 'src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectArrayEq, expectEvent, expectThrow } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from 'test/utils/setup';
import { GMX_V2_CALLBACK_GAS_LIMIT } from '../../../src/utils/constructors/gmx';
import { createExpirationLibrary } from '../../utils/expiry-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const amountWei = parseEther('1');
const defaultAccountNumber = 0;

describe('GmxV2IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistryV2: GmxRegistryV2;
  let expirationLibrary: Contract;
  let gmxV2Library: GmxV2Library;
  let allowableMarketIds: BigNumberish[];
  let vaultImplementation: GmxV2IsolationModeTokenVaultV1;
  let factory: GmxV2IsolationModeVaultFactory;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let impersonatedWrapper: Signer;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    gmxRegistryV2 = await createGmxRegistryV2(core, GMX_V2_CALLBACK_GAS_LIMIT);
    expirationLibrary = await createExpirationLibrary();
    gmxV2Library = await createGmxV2Library();
    vaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core, gmxV2Library);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      expirationLibrary,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      vaultImplementation,
    );

    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxRegistryV2,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxRegistryV2,
    );
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
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
      expect(await factory.gmxRegistryV2()).to.equal(gmxRegistryV2.address);
      expect(await factory.SHORT_TOKEN()).to.equal(core.tokens.nativeUsdc!.address);
      expect(await factory.LONG_TOKEN()).to.equal(core.tokens.weth.address);
      expect(await factory.INDEX_TOKEN()).to.equal(core.tokens.weth.address);
      expectArrayEq(await factory.allowableDebtMarketIds(), [core.marketIds.nativeUsdc!, core.marketIds.weth]);
      expectArrayEq(
        await factory.allowableCollateralMarketIds(),
        [core.marketIds.nativeUsdc!, core.marketIds.weth, marketId],
      );
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystemV2!.gmxEthUsdMarketToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });

    it('should construct if allowable market ids is in either order', async () => {
      await createGmxV2IsolationModeVaultFactory(
        core,
        expirationLibrary,
        gmxRegistryV2,
        allowableMarketIds,
        allowableMarketIds,
        core.gmxEcosystemV2!.gmxEthUsdMarketToken,
        vaultImplementation,
      );
      await createGmxV2IsolationModeVaultFactory(
        core,
        expirationLibrary,
        gmxRegistryV2,
        [allowableMarketIds[1], allowableMarketIds[0]],
        [allowableMarketIds[1], allowableMarketIds[0]],
        core.gmxEcosystemV2!.gmxEthUsdMarketToken,
        vaultImplementation,
      );
    });

    it('should fail if allowable debt market ids does not have length of 2', async () => {
      const badAllowableDebtMarketIds = [1];
      await expectThrow(
        createGmxV2IsolationModeVaultFactory(
          core,
          expirationLibrary,
          gmxRegistryV2,
          badAllowableDebtMarketIds,
          allowableMarketIds,
          core.gmxEcosystemV2!.gmxEthUsdMarketToken,
          vaultImplementation,
        ),
        'GmxV2IsolationModeVaultFactory: Invalid market IDs length',
      );
    });

    it('should fail if allowable debt market ids does not have length of 2', async () => {
      const badAllowableDebtMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.dai!];
      await expectThrow(
        createGmxV2IsolationModeVaultFactory(
          core,
          expirationLibrary,
          gmxRegistryV2,
          badAllowableDebtMarketIds,
          allowableMarketIds,
          core.gmxEcosystemV2!.gmxEthUsdMarketToken,
          vaultImplementation,
        ),
        'GmxV2IsolationModeVaultFactory: Invalid market IDs length',
      );
    });

    it('should fail if allowable collateral market ids does not have short and long token', async () => {
      const badAllowableCollateralMarketIds = [1];
      await expectThrow(
        createGmxV2IsolationModeVaultFactory(
          core,
          expirationLibrary,
          gmxRegistryV2,
          allowableMarketIds,
          badAllowableCollateralMarketIds,
          core.gmxEcosystemV2!.gmxEthUsdMarketToken,
          vaultImplementation,
        ),
        'GmxV2IsolationModeVaultFactory: Invalid market IDs length',
      );
    });

    it('should fail if allowable collateral market ids does not have short and long token', async () => {
      const badAllowableCollateralMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.dai!];
      await expectThrow(
        createGmxV2IsolationModeVaultFactory(
          core,
          expirationLibrary,
          gmxRegistryV2,
          allowableMarketIds,
          badAllowableCollateralMarketIds,
          core.gmxEcosystemV2!.gmxEthUsdMarketToken,
          vaultImplementation,
        ),
        'GmxV2IsolationModeVaultFactory: Invalid market IDs length',
      );
    });
  });

  describe('#ownerSetGmxRegistryV2', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetGmxRegistryV2(OTHER_ADDRESS);
      await expectEvent(factory, result, 'GmxRegistryV2Set', {
        gmxRegistryV2: OTHER_ADDRESS,
      });
      expect(await factory.gmxRegistryV2()).to.eq(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetGmxRegistryV2(OTHER_ADDRESS),
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
        'GmxV2IsolationModeVaultFactory: Invalid execution fee',
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

  describe('#depositOtherTokenIntoDolomiteMarginFromTokenConverter', () => {
    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).depositOtherTokenIntoDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          ZERO_BI,
          amountWei,
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositOtherTokenIntoDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          ZERO_BI,
          amountWei,
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if otherMarketId is underlyingMarketId', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositOtherTokenIntoDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          marketId,
          amountWei,
        ),
        `GmxV2IsolationModeVaultFactory: Invalid market <${marketId.toString()}>`,
      );
    });
  });

  describe('#withdrawFromDolomiteMarginFromTokenConverter', () => {
    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).withdrawFromDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          amountWei,
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).withdrawFromDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          amountWei,
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setIsDepositSourceWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.isDepositSourceWrapper()).to.eq(false);
      await factory.connect(impersonatedWrapper).setIsDepositSourceWrapper(vault.address, true);
      expect(await vault.isDepositSourceWrapper()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setIsDepositSourceWrapper(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setIsDepositSourceWrapper(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.shouldSkipTransfer()).to.eq(false);
      await factory.connect(impersonatedWrapper).setShouldSkipTransfer(vault.address, true);
      expect(await vault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setShouldSkipTransfer(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setShouldSkipTransfer(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

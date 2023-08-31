import { expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
} from 'src/types';
import { Network, ZERO_BI } from 'src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectArrayEq, expectEvent, expectThrow } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from 'test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const amountWei = parseEther('1');
const defaultAccountNumber = 0;

describe('GmxV2IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistryV2: GmxRegistryV2;
  let vaultImplementation: GmxV2IsolationModeTokenVaultV1;
  let factory: GmxV2IsolationModeVaultFactory;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let impersonatedWrapper: Signer;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    gmxRegistryV2 = await createGmxRegistryV2(core);
    vaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      [], // initialAllowableDebtMarketIds
      [], // initialAllowableCollateralMarketIds
      core.gmxEcosystem!.gmxEthUsdMarketToken,
      vaultImplementation
    );

    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
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
      core.hhUser1
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
      expect(await factory.initialShortToken()).to.equal(core.tokens.nativeUsdc!.address);
      expect(await factory.initialShortTokenMarketId()).to.equal(core.marketIds.nativeUsdc!);
      expect(await factory.initialLongToken()).to.equal(core.tokens.weth.address);
      expect(await factory.initialLongTokenMarketId()).to.equal(core.marketIds.weth);
      expectArrayEq(await factory.allowableDebtMarketIds(), []);
      expectArrayEq(await factory.allowableCollateralMarketIds(), []);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem!.gmxEthUsdMarketToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
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
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#depositIntoDolomiteMarginFromTokenConverter', () => {
    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).depositIntoDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          amountWei
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositIntoDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          amountWei
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
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
          amountWei
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositOtherTokenIntoDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          ZERO_BI,
          amountWei
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if otherMarketId is underlyingMarketId', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).depositOtherTokenIntoDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          marketId,
          amountWei
        ),
        `GmxV2IsolationModeVaultFactory: Invalid market <${marketId.toString()}>`
      );
    });
  });

  describe('#withdrawFromDolomiteMarginFromTokenConverter', () => {
    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).withdrawFromDolomiteMarginFromTokenConverter(
          vault.address,
          defaultAccountNumber,
          amountWei
        ),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).withdrawFromDolomiteMarginFromTokenConverter(
          core.hhUser1.address,
          defaultAccountNumber,
          amountWei
        ),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setVaultFrozen', () => {
    it('should work normally', async () => {
      expect(await vault.isVaultFrozen()).to.eq(false);
      await factory.connect(impersonatedWrapper).setVaultFrozen(vault.address, true);
      expect(await vault.isVaultFrozen()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setVaultFrozen(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setVaultFrozen(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setSourceIsWrapper', () => {
    it('should work normally', async () => {
      expect(await vault.isSourceIsWrapper()).to.eq(false);
      await factory.connect(impersonatedWrapper).setSourceIsWrapper(vault.address, true);
      expect(await vault.isSourceIsWrapper()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setSourceIsWrapper(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setSourceIsWrapper(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      await factory.connect(impersonatedWrapper).setShouldSkipTransfer(vault.address, true);
      expect(await vault.isShouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).setShouldSkipTransfer(vault.address, true),
        `IsolationModeVaultFactory: Caller is not a token converter <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid vault', async () => {
      await expectThrow(
        factory.connect(impersonatedWrapper).setShouldSkipTransfer(core.hhUser1.address, false),
        `IsolationModeVaultFactory: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});

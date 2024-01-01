import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'src/utils';
import {
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '../../../src/types';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createGLPIsolationModeTokenVaultV2,
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createGMXUnwrapperTraderV2,
  createGMXWrapperTraderV2,
} from '../../utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { setupNewGenericTraderProxy } from '../../utils/dolomite';
import { depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('GmxIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let dGmxMarketId: BigNumber;
  let gmxMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let vault: GMXIsolationModeTokenVaultV1;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.gmxEcosystem!.gmx;
    gmxRegistry = await createGmxRegistry(core);

    const gmxVaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, gmxVaultImplementation);
    const glpVaultImplementation = await createGLPIsolationModeTokenVaultV2();
    glpFactory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, glpVaultImplementation);

    // Setup markets
    gmxMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.gmx!.address);
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.gmx!.address, '1000000000000000000');

    dGmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await setupTestMarket(core, glpFactory, true);

    unwrapper = await createGMXUnwrapperTraderV2(core, gmxFactory);
    wrapper = await createGMXWrapperTraderV2(core, gmxFactory);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);
    await gmxFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await glpFactory.connect(core.governance).ownerInitialize([]);

    await gmxFactory.createVault(core.hhUser1.address);
    const vaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      vaultAddress,
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };
    await setupGMXBalance(core, core.hhUser1, amountWei, vault);
    await vault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    await setupNewGenericTraderProxy(core, dGmxMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      await core.dolomiteMargin.ownerSetMaxWei(gmxMarketId, ZERO_BI);
      const vaultSigner = await impersonate(vault.address, true);
      await setupGMXBalance(core, vaultSigner, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, vaultSigner, defaultAccountNumber, gmxMarketId, amountWei);
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: ZERO_ADDRESS,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: ZERO_ADDRESS,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: dGmxMarketId,
        inputMarket: gmxMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, dGmxMarketId);
      expect(underlyingBalanceWei.value).to.eq(amountWei.mul(2));
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei.mul(2));

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, gmxMarketId);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          gmxFactory.address,
          core.tokens.gmx!.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          gmxFactory.address,
          core.tokens.dfsGlp!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.gmx!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          gmxFactory.address,
          core.tokens.gmx!.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work with gmx token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.gmx!.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.usdc.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await wrapper.getExchangeCost(core.tokens.gmx!.address, gmxFactory.address, amountWei, BYTES_EMPTY))
        .to
        .eq(amountWei);
    });
  });
});

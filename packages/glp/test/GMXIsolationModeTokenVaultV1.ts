import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  ADDRESS_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  createDolomiteAccountRegistryImplementation,
  createDolomiteRegistryImplementation,
  createRegistryProxy,
} from '../../base/test/utils/dolomite';
import {
  GLPIsolationModeVaultFactory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
  TestGMXIsolationModeTokenVaultV1,
  TestGMXIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createGMXUnwrapperTraderV2,
  createGMXWrapperTraderV2,
  createTestGLPIsolationModeTokenVaultV2,
  createTestGMXIsolationModeTokenVaultV1,
} from './glp-ecosystem-utils';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';

const gmxAmount = parseEther('10'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const esGmxAmount = parseEther('0.01'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GMXIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let gmxVault: TestGMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let dGlpMarketId: BigNumber;
  let dGmxMarketId: BigNumber;
  let gmxMarketId: BigNumber;
  let otherImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING,
      network: Network.ArbitrumOne,
    });

    gmxRegistry = await createGmxRegistry(core);

    const glpVaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    glpFactory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, glpVaultImplementation);
    const vaultImplementation = await createTestGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, vaultImplementation);

    const registryImplementation = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(registryImplementation.address);

    const accountRegistryImplementation = await createDolomiteAccountRegistryImplementation();
    const accountRegistry = await createRegistryProxy(
      accountRegistryImplementation.address,
      await accountRegistryImplementation.populateTransaction.initialize([]),
      core,
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteAccountRegistry(accountRegistry.address);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    dGlpMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, glpFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);
    await glpFactory.connect(core.governance).ownerInitialize([]);

    unwrapper = await createGMXUnwrapperTraderV2(core, gmxFactory);
    wrapper = await createGMXWrapperTraderV2(core, gmxFactory);
    dGmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    gmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.gmx.address, '1000000000000000000');
    await setupTestMarket(core, core.tokens.gmx, false);

    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<TestGMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      TestGMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
    await core
      .gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, ONE_BI, ONE_BI);
    // // use sGLP for approvals/transfers and fsGLP for checking balances
    // const glpAmount = await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
    await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);
    // await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    // Make sure distributor has high tokens per interval and enough esGMX
    await core.gmxEcosystem.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core
      .gmxEcosystem!.esGmx.connect(gov)
      .mint(core.gmxEcosystem.esGmxDistributorForStakedGmx.address, parseEther('100000000'));
    otherImpersonator = await impersonate(OTHER_ADDRESS, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function doHandleRewardsWithWaitTime(daysToWait: number) {
    if (daysToWait > 0) {
      await waitDays(daysToWait);
    }
    await glpVault.handleRewardsWithSpecificDepositAccountNumber(
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      accountNumber,
    );
  }

  async function requestTransferAndSignal(gmxAmount: BigNumber, glpAmount: BigNumber) {
    await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    expect(await gmxVault.recipient()).to.eq(OTHER_ADDRESS);

    const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, glpAmount);
    await expectEvent(gmxVault, result, 'AccountTransferSignaled', {
      recipient: OTHER_ADDRESS,
    });
    expect(await gmxVault.recipient()).to.eq(ADDRESS_ZERO);
    expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(OTHER_ADDRESS);
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
    await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
  }

  describe('#requestAccountTransfer', () => {
    it('should work normally', async () => {
      const result = await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {
        recipient: OTHER_ADDRESS,
      });
      expect(await gmxVault.recipient()).to.eq(OTHER_ADDRESS);
      expect(await gmxVault.isVaultFrozen()).to.be.true;
      expect(await glpVault.isVaultFrozen()).to.be.true;
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).requestAccountTransfer(OTHER_ADDRESS),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer is already in progress', async () => {
      const result = await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {
        recipient: OTHER_ADDRESS,
      });

      await expectThrow(
        gmxVault.requestAccountTransfer(OTHER_ADDRESS),
        'GMXIsolationModeTokenVaultV1: Transfer already in progress',
      );
    });
  });

  describe('#signalAccountTransfer', () => {
    it('should work normally with staked gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
    });

    it('should work normally with glp balance', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
    });

    it('should work normally with glp and gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
    });

    it('should work normally when need to stake gmx', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);
      expect(await core.gmxEcosystem.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
    });

    it('should work normally if user has no gmx or glp balance but has esGMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await waitDays(30);
      await glpVault.handleRewards(true, false, true, false, true, true, false);
      await gmxVault.withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      const esGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);
      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);

      expect(await core.gmxEcosystem.esGmx.balanceOf(OTHER_ADDRESS)).to.eq(esGmxAmount);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
    });

    it('should work normally if user has no gmx or glp balance', async () => {
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(ZERO_BI);
      expect(await core.gmxEcosystem.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(ZERO_BI);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
    });

    it('should cancel transfer if gmx virtual balance is incorrect', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(ONE_BI, ZERO_BI);
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectThrow(gmxVault.cancelAccountTransfer(), 'GMXIsolationModeTokenVaultV1: Transfer not in progress');
    });

    it('should cancel transfer if glp virtual balance is incorrect', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(ZERO_BI, ONE_BI);
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectThrow(gmxVault.cancelAccountTransfer(), 'GMXIsolationModeTokenVaultV1: Transfer not in progress');
    });

    it('transfer back and forth FAILS', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      await expectThrow(
        core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).signalTransfer(glpVault.address),
      );
    });

    it('should fail if no transfer is requested', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).signalAccountTransfer(gmxAmount, ZERO_BI),
        `GMXIsolationModeTokenVaultV1: Invalid handler <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#cancelAccountTransfer', () => {
    it('should work normally after user requests transfer', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      const result = await gmxVault.cancelAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);

      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should work normally with gmx bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      const result = await gmxVault.cancelAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, ZERO_BI);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should work normally with glp bal', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, amountWei);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should work normally with gmx and glp bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, dGlpMarketId, amountWei);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should fail if transfer was already cancelled by handler', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await expectThrow(gmxVault.cancelAccountTransfer(), 'GMXIsolationModeTokenVaultV1: Transfer not in progress');
    });

    it('should fail if underlying balance is less than temp balance on glp vault', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      const glpVaultImpersonator = await impersonate(glpVault.address, true);
      await core.gmxEcosystem.sGlp.connect(glpVaultImpersonator).transfer(core.hhUser1.address, amountWei);

      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GLPIsolationModeTokenVaultV2: Invalid underlying balance of',
      );
    });

    it('should fail if underlying balance is less than temp balance on gmx vault', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      const glpVaultImpersonator = await impersonate(glpVault.address, true);
      await core.gmxEcosystem.gmxRewardsRouterV2.connect(glpVaultImpersonator).unstakeGmx(gmxAmount);
      await core.tokens.gmx.connect(glpVaultImpersonator).transfer(core.hhUser1.address, gmxAmount);

      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Invalid underlying balance of',
      );
    });

    it('should fail if there is no transfer in progress', async () => {
      await expectThrow(gmxVault.cancelAccountTransfer(), 'GMXIsolationModeTokenVaultV1: Transfer not in progress');
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).cancelAccountTransfer(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#acceptFullAccountTransfer', () => {
    it('should fail if vault is frozen', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectThrow(
        glpVault.connect(core.hhUser5).acceptFullAccountTransfer(glpVault.address),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  describe('#stakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await gmxVault.stakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
    });

    it('should work when GMX is already approved for staking', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      await glpVault.setApprovalForGmxForStaking(gmxAmount.div(2)); // use an amount < gmxAmount
      await gmxVault.stakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).stakeGmx(gmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.unstakeGmx(gmxAmount);
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.tokens.gmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).unstakeGmx(gmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#vestGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(ZERO_BI);
      await doHandleRewardsWithWaitTime(30);
      const gmxAmountVested = await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      expect(await core.gmxEcosystem.vGmx.pairAmounts(glpVault.address)).to.eq(gmxAmountVested);
      // the amount of GMX in the vault should be unchanged if some of it moves into vesting
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect((await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).gt(gmxAmount.sub(gmxAmountVested))).to.eq(
        true,
      );
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, gmxAmount);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).vestGmx(esGmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unvestGmx', () => {
    it('should work when GMX is re-staked', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(true);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        dGmxMarketId,
        gmxAmount.add(esGmxAmount),
      );
    });

    it('should work when vested GMX is withdrawn and staked', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(true);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        dGmxMarketId,
        gmxAmount.add(esGmxAmount),
      );
    });

    it('should work when vested GMX is withdrawn and not staked', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(false);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        dGmxMarketId,
        gmxAmount,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        accountNumber,
        gmxMarketId,
        esGmxAmount,
      );
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).unvestGmx(false),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);

      await gmxVault.unstakeGmx(gmxAmount);

      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.tokens.gmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally with should skip transfer is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(true);

      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally when is deposit source GLP vault is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(true);
      await setupGMXBalance(core, glpVaultImpersonator, gmxAmount, gmxVault);

      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.tokens.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx.balanceOf(glpVaultImpersonator.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, gmxAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, gmxAmount);
    });

    it('should work when have to unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, gmxAmount);
    });

    it('should work normally when have to unvest & unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      const vaultAccount = { owner: gmxVault.address, number: accountNumber };
      expect(await glpVault.gmxBalanceOf()).to.be.gt(ZERO_BI);
      await expectWalletBalance(glpVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(glpVault.address, core.gmxEcosystem.vGmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, gmxAmount);
      // Balance should be greater than 0 because of vesting
      await expectProtocolBalanceIsGreaterThan(core, vaultAccount, dGmxMarketId, ONE_BI, 1);
      expect(await glpVault.gmxBalanceOf()).to.be.gt(ZERO_BI);
      await expectWalletBalance(gmxVault, core.tokens.gmx, ZERO_BI);
    });

    it('should work normally when have to unstake but not unvest GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);

      const gmxVaultSigner = await impersonate(gmxVault.address, true);
      const maxUnstakeAmount = (await glpVault.connect(gmxVaultSigner).callStatic.maxGmxUnstakeAmount()).sub(1);
      expect(maxUnstakeAmount).to.be.gt(ZERO_BI);
      expect(maxUnstakeAmount).to.not.eq(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, maxUnstakeAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.sub(maxUnstakeAmount));
      await expectWalletBalance(glpVault, core.gmxEcosystem.vGmx, esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, maxUnstakeAmount);
      await expectWalletBalance(gmxVault, core.tokens.gmx, ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault,
        accountNumber,
        dGmxMarketId,
        gmxAmount.sub(maxUnstakeAmount),
      );
    });

    it('should work normally when we have to unstake and BARELY unvest GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);

      const gmxVaultSigner = await impersonate(gmxVault.address, true);
      const maxUnstakeAmount = await glpVault.connect(gmxVaultSigner).callStatic.maxGmxUnstakeAmount();
      expect(maxUnstakeAmount).to.be.gt(ZERO_BI);
      expect(maxUnstakeAmount).to.not.eq(gmxAmount);

      // Max unstake amount has a rounding issue where it's usually off by 1. So, we add 2 to push it over the max
      const unstakeAmount = maxUnstakeAmount.add(2);
      await glpVault.setSkipClaimingBnGmx(true);
      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, unstakeAmount);

      // We can't get the precise amount because unstakeAmount ticks up
      expect(await glpVault.gmxBalanceOf()).to.be.gt(gmxAmount.sub(unstakeAmount));
      await expectWalletBalance(glpVault, core.gmxEcosystem.vGmx, ZERO_BI);
      await expectWalletBalance(glpVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, unstakeAmount);

      const gmxBalance = await core.tokens.gmx.balanceOf(gmxVault.address);
      await expectWalletBalance(gmxVault, core.tokens.gmx, gmxBalance);
      expect(gmxBalance).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gmxVault.address, number: accountNumber },
        dGmxMarketId,
        gmxAmount.sub(unstakeAmount),
        ZERO_BI,
      );
    });

    it('should work normally when have to unstake all BUT not unvest GMX (sbfGMX is large)', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(3650);
      const esGmxBalance = await glpVault.esGmxBalanceOf();
      await glpVault.stakeEsGmx(esGmxBalance.sub(esGmxAmount));
      await gmxVault.vestGmx(esGmxAmount);

      const gmxVaultSigner = await impersonate(gmxVault.address, true);
      const maxUnstakeAmount = await glpVault.connect(gmxVaultSigner).callStatic.maxGmxUnstakeAmount();
      await expectThrow(gmxVault.withdrawFromVaultForDolomiteMargin(accountNumber, maxUnstakeAmount.add(1)));
      expect(maxUnstakeAmount).to.be.gt(ZERO_BI);
      expect(maxUnstakeAmount).to.eq(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, maxUnstakeAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.connect(gmxVaultSigner).callStatic.maxGmxUnstakeAmount()).to.eq(ZERO_BI);
      await expectWalletBalance(glpVault, core.gmxEcosystem.vGmx, esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, maxUnstakeAmount);
      await expectWalletBalance(gmxVault, core.tokens.gmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault, accountNumber, dGmxMarketId, ZERO_BI);
    });

    it('should work normally when unvest, unstake, and sweep', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      await waitDays(366);
      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, dGmxMarketId, esGmxAmount);
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, gmxAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#underlyingBalanceOf', () => {
    it('should work normally with staking', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(gmxAmount);
    });

    it('should work normally with staking and vesting', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(ZERO_BI);
      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(gmxAmount);
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);

      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(true);
      expect(await gmxVault.shouldSkipTransfer()).to.be.true;
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(false);
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setIsDepositSourceGLPVault', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);

      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(true);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.true;
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(false);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).setIsDepositSourceGLPVault(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await gmxVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await gmxVault.registry()).to.equal(gmxRegistry.address);
    });
  });
});

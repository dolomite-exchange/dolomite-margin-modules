import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
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
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createGMXUnwrapperTraderV2,
  createGMXWrapperTraderV2,
  createTestGLPIsolationModeTokenVaultV2,
  createTestGMXIsolationModeTokenVaultV1,
} from './glp-ecosystem-utils';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const gmxAmount = parseEther('10'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const esGmxAmount = parseEther('0.01'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;
const otherAccountNumber = BigNumber.from('123');
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
  let gmxMarketId: BigNumber;
  let underlyingMarketIdGlp: BigNumber;
  let underlyingMarketIdGmx: BigNumber;
  let otherImpersonator: SignerWithAddress;

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

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    underlyingMarketIdGlp = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, glpFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);
    await glpFactory.connect(core.governance).ownerInitialize([]);

    unwrapper = await createGMXUnwrapperTraderV2(core, gmxFactory);
    wrapper = await createGMXWrapperTraderV2(core, gmxFactory);
    underlyingMarketIdGmx = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    gmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.gmx!.address, '1000000000000000000');
    await setupTestMarket(core, core.tokens.gmx!, false);

    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetHandler(core.hhUser5.address);

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

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
      core.tokens.usdc.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    // // use sGLP for approvals/transfers and fsGLP for checking balances
    // const glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);
    // await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    // Make sure distributor has high tokens per interval and enough esGMX
    await core.gmxEcosystem!.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core.gmxEcosystem!.esGmx.connect(gov).mint(
      core.gmxEcosystem!.esGmxDistributorForStakedGmx.address,
      parseEther('100000000'),
    );
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

    await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, glpAmount);
    expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(OTHER_ADDRESS);
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
    await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
  }

  describe('#requestAccountTransfer', () => {
    it('should work normally', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
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
  });

  describe('#signalAccountTransfer', () => {
    it('should work normally with staked gmx bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      // @follow-up Why not equal
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with glp bal', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with glp and gmx bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV2.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      // @follow-up Why not equal
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally when need to stake gmx', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);
      expect(await core.gmxEcosystem.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
    });

    it('should cancel transfer if gmx virtual balance is incorrect', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      await gmxVault.connect(core.hhUser5).signalAccountTransfer(ONE_BI, ZERO_BI);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
    });

    it('should cancel transfer if glp virtual balance is incorrect', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      await gmxVault.connect(core.hhUser5).signalAccountTransfer(ZERO_BI, ONE_BI);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
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
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Invalid handler',
      );
    });
  });

  describe('#cancelAccountTransfer', () => {
    it('should work normally with gmx bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with glp bal', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV2.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, amountWei);
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
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, amountWei);
    });

    it('should fail if there is no transfer in progress', async () => {
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).cancelAccountTransfer(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
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
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
    });

    it('should work when GMX is already approved for staking', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      await glpVault.setApprovalForGmxForStaking(gmxAmount.div(2)); // use an amount < gmxAmount
      await gmxVault.stakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
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
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
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

      expect(await core.gmxEcosystem!.vGmx.pairAmounts(glpVault.address)).to.eq(gmxAmountVested);
      // the amount of GMX in the vault should be unchanged if some of it moves into vesting
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address))
        .gt(gmxAmount.sub(gmxAmountVested))).to.eq(true);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
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
        underlyingMarketIdGmx,
        gmxAmount.add(esGmxAmount),
      );
    });

    it('should work when vested GMX is withdrawn', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(false);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingMarketIdGmx,
        gmxAmount.add(esGmxAmount),
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

      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally with should skip transfer is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(true);

      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally when is deposit source GLP vault is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(true);
      await setupGMXBalance(core, glpVaultImpersonator, gmxAmount, gmxVault);

      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(glpVaultImpersonator.address)).to.eq(ZERO_BI);
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
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, gmxAmount);
    });

    it('should work when have to unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, gmxAmount);
    });

    it('should work normally when have to unvest & unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      const vaultAccount = { owner: gmxVault.address, number: accountNumber };
      expect(await glpVault.gmxBalanceOf()).to.be.gt(ZERO_BI);
      await expectWalletBalance(glpVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(glpVault.address, core.gmxEcosystem!.vGmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, gmxAmount);
      // Balance should be greater than 0 because of vesting
      await expectProtocolBalanceIsGreaterThan(core, vaultAccount, underlyingMarketIdGmx, ONE_BI, 1);
      expect(await glpVault.gmxBalanceOf()).to.be.gt(ZERO_BI);
      await expectWalletBalance(gmxVault, core.tokens.gmx!, ZERO_BI);
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
      await expectWalletBalance(glpVault, core.gmxEcosystem!.vGmx, esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, maxUnstakeAmount);
      await expectWalletBalance(gmxVault, core.tokens.gmx!, ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault,
        accountNumber,
        underlyingMarketIdGmx,
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
      await expectWalletBalance(glpVault, core.gmxEcosystem!.vGmx, ZERO_BI);
      await expectWalletBalance(glpVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, unstakeAmount);

      const gmxBalance = await core.tokens.gmx!.balanceOf(gmxVault.address);
      await expectWalletBalance(gmxVault, core.tokens.gmx!, gmxBalance);
      expect(gmxBalance).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gmxVault.address, number: accountNumber },
        underlyingMarketIdGmx,
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
      await expectThrow(
        gmxVault.withdrawFromVaultForDolomiteMargin(accountNumber, maxUnstakeAmount.add(1)),
      );
      expect(maxUnstakeAmount).to.be.gt(ZERO_BI);
      expect(maxUnstakeAmount).to.eq(gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, maxUnstakeAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.connect(gmxVaultSigner).callStatic.maxGmxUnstakeAmount()).to.eq(ZERO_BI);
      await expectWalletBalance(glpVault, core.gmxEcosystem!.vGmx, esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, maxUnstakeAmount);
      await expectWalletBalance(gmxVault, core.tokens.gmx!, ZERO_BI);
      await expectProtocolBalance(core, gmxVault, accountNumber, underlyingMarketIdGmx, ZERO_BI);
    });

    it('should work normally when unvest, unstake, and sweep', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      await waitDays(366);
      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(esGmxAmount);
      await expectWalletBalance(glpVault.address, core.tokens.gmx!, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.tokens.gmx!, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, esGmxAmount);
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

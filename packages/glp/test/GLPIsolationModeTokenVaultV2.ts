import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeTokenVaultV2__factory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  IGLPIsolationModeVaultFactoryOld,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
} from '../src/types';
import {
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createTestGLPIsolationModeTokenVaultV2,
} from './glp-ecosystem-utils';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens

const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;

describe('GLPIsolationModeTokenVaultV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let underlyingGlpMarketId: BigNumber;
  let underlyingGmxMarketId: BigNumber;
  let glpAmount: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let account: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING,
      network: Network.ArbitrumOne,
    });
    gmxRegistry = await createGmxRegistry(core);

    const vaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    glpFactory = core.gmxEcosystem!.live.dGlp;
    await glpFactory.connect(core.governance).setUserVaultImplementation(vaultImplementation.address);
    await glpFactory.connect(core.governance).setGmxRegistry(gmxRegistry.address);

    const gmxVaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, gmxVaultImplementation);

    underlyingGlpMarketId = BigNumber.from(core.marketIds.dfsGlp!);
    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await core.dolomiteMargin.connect(core.governance)
      .ownerSetPriceOracle(underlyingGlpMarketId, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);

    underlyingGmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([]);

    await glpFactory.createVault(core.hhUser1.address);
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );
    account = { owner: glpVault.address, number: accountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
      core.tokens.usdc.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    // use sGLP for approvals/transfers and fsGLP for checking balances
    glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);
    await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
    expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(glpVault.address)).to.eq(amountWei);
    expect(await glpVault.underlyingBalanceOf()).to.eq(amountWei);

    const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingGlpMarketId);
    expect(glpProtocolBalance.sign).to.eq(true);
    expect(glpProtocolBalance.value).to.eq(amountWei);

    await core.gmxEcosystem!.esGmxDistributorForStakedGlp.setTokensPerInterval('10333994708994708');
    await core.gmxEcosystem!.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core.gmxEcosystem!.esGmx.connect(gov).mint(
      core.gmxEcosystem!.esGmxDistributorForStakedGmx.address,
      parseEther('100000000'),
    );
    await core.gmxEcosystem!.esGmx.connect(gov).mint(
      core.gmxEcosystem!.esGmxDistributorForStakedGlp.address,
      parseEther('100000000'),
    );
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);

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

  describe('#initialize', () => {
    it('should work normally with no existing gmxVault', async () => {
      await glpFactory.createVault(core.hhUser2.address);
      const vault2 = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
        await glpFactory.getVaultByAccount(core.hhUser2.address),
        TestGLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await vault2.getGmxVaultOrCreate();

      const gmxVaultAddress = gmxFactory.getVaultByAccount(core.hhUser2.address);
      expect(gmxVaultAddress).to.not.eq(ZERO_ADDRESS);
      expect(await vault2.hasSynced()).to.be.true;
    });

    it('should work normally with existing gmxVault', async () => {
      await gmxFactory.createVault(core.hhUser2.address);

      const vault2 = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
        await glpFactory.getVaultByAccount(core.hhUser2.address),
        TestGLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await vault2.getGmxVaultOrCreate();

      const gmxVaultAddress = gmxFactory.getVaultByAccount(core.hhUser2.address);
      expect(gmxVaultAddress).to.not.eq(ZERO_ADDRESS);
      expect(await vault2.hasSynced()).to.be.true;
    });

    it('should fail when already initialized', async () => {
      await expectThrow(
        glpVault.initialize(),
        'IsolationModeTokenVaultV1: Already initialized',
      );
    });
  });

  describe('#handleRewards', () => {
    async function setupGmxStakingAndEsGmxVesting() {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).gte(gmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.eq(ZERO_BI);
      return gmxVault;
    }

    it('should work when assets are claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        false,
      );

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(esGmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      await waitDays(366);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        false,
      );

      // GMX rewards should be passed along to the glpVault if they're NOT staked
      const rewardAmount = BigNumber.from('20000000000000000');
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingGmxMarketId,
        gmxAmount.add(rewardAmount),
      );
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(rewardAmount));
    });

    it('should work when gmx is claimed and staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        false,
      );

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(esGmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      await waitDays(366);
      await glpVault.handleRewards(
        true,
        true, // Stake GMX
        true,
        false, // Stake esGMX
        true,
        true,
        false,
      );

      // GMX rewards should be staked
      const rewardAmount = BigNumber.from('20000000000000000');
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingGmxMarketId,
        gmxAmount.add(rewardAmount),
      );
    });

    it('should work when assets are claimed and staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      // Don't stake anything on the first go-around. We need the esGMX to initialize vesting
      await waitDays(30);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        false,
        true,
        false,
      );

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      const glpVestableAmount = await core.gmxEcosystem!.vGlp.getMaxVestableAmount(glpVault.address);
      const gmxVestableAmount = await core.gmxEcosystem!.vGmx.getMaxVestableAmount(glpVault.address);
      expect(glpVestableAmount.gt(ZERO_BI)).to.eq(true);
      expect(gmxVestableAmount.gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(glpVestableAmount);
      await gmxVault.vestGmx(gmxVestableAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);

      const stakedGmx = await core.gmxEcosystem!.vGmx.pairAmounts(glpVault.address);

      await waitDays(366);
      const sbfGmxBalanceBefore = await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address);
      await glpVault.handleRewards(
        true,
        true, // Stake GMX
        true,
        true, // Stake esGMX
        true,
        true,
        false,
      );
      const sbfGmxBalanceAfter = await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address);

      // the esGMX should have been converted to GMX and staked into sbfGMX
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address))
        .gt(esGmxAmount.add(gmxAmount).sub(stakedGmx))).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // GMX rewards should be passed along to the glpVault as sbfGMX if they're staked
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(sbfGmxBalanceAfter.gt(sbfGmxBalanceBefore)).to.eq(true);
      const gmxAccount = { owner: gmxVault.address, number: accountNumber };
      expect((await core.dolomiteMargin.getAccountWei(gmxAccount, underlyingGmxMarketId)).value).to.be.gt(gmxAmount);
    });

    it('should work when assets are claimed and staked on first go-around', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewards(
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      );

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingGlpMarketId, amountWei);
    });

    it('should work when assets are claimed and not staked and deposited into Dolomite', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        true,
      );

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(ZERO_BI)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingGlpMarketId, amountWei);
    });

    it('should work when assets are not claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewards(
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      );

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
      expect(balance2.sign).to.eq(false);
      expect(balance2.value).to.eq(ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      await expectThrow(
        glpVault.callHandleRewardsAndTriggerReentrancy(
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2)
          .handleRewards(
            false,
            false,
            false,
            false,
            false,
            false,
            false,
          ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when attempting to deposit WETH when not claiming', async () => {
      await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await expectThrow(
        glpVault.handleRewards(true, false, true, false, true, false, true),
        'GLPIsolationModeTokenVaultV2: Can only deposit ETH if claiming',
      );
    });
  });

  describe('#handleRewardsWithSpecificDepositAccountNumber', () => {
    const accountNumber = BigNumber.from(123);

    async function setupGmxStakingAndEsGmxVesting() {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(ZERO_BI, gmxAmount);

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).gte(gmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      return gmxVault;
    }

    it('should work when assets are claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
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

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(esGmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      await waitDays(366);
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

      // GMX rewards should be passed along to the glpVault owner if they're NOT staked
      const rewardAmount = BigNumber.from('20000000000000000');
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, ZERO_BI, underlyingGmxMarketId, gmxAmount.add(rewardAmount));
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(rewardAmount));
    });

    it('should work when gmx is claimed and staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
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

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(esGmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      await waitDays(366);
      await glpVault.handleRewardsWithSpecificDepositAccountNumber(
        true,
        true, // Stake GMX
        true,
        false, // Stake esGMX
        true,
        true,
        false,
        accountNumber,
      );

      // GMX rewards should be staked
      const rewardAmount = BigNumber.from('20000000000000000');
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, ZERO_BI, underlyingGmxMarketId, gmxAmount.add(rewardAmount));
    });

    it('should work when assets are claimed and staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      // Don't stake anything on the first go-around. We need the esGMX to initialize vesting
      await waitDays(30);
      await glpVault.handleRewardsWithSpecificDepositAccountNumber(
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        accountNumber,
      );

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect((await core.tokens.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);

      const glpVestableAmount = await core.gmxEcosystem!.vGlp.getMaxVestableAmount(glpVault.address);
      const gmxVestableAmount = await core.gmxEcosystem!.vGmx.getMaxVestableAmount(glpVault.address);
      expect(glpVestableAmount.gt(ZERO_BI)).to.eq(true);
      expect(gmxVestableAmount.gt(ZERO_BI)).to.eq(true);

      await glpVault.vestGlp(glpVestableAmount);
      await gmxVault.vestGmx(gmxVestableAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);

      const stakedGmx = await core.gmxEcosystem!.vGmx.pairAmounts(glpVault.address);

      await waitDays(366);
      const sbfGmxBalanceBefore = await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address);
      await glpVault.handleRewardsWithSpecificDepositAccountNumber(
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        accountNumber,
      );
      const sbfGmxBalanceAfter = await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address);

      // the esGMX should have been converted to GMX and staked into sbfGMX
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address))
        .gt(esGmxAmount.add(gmxAmount).sub(stakedGmx))).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // GMX rewards should be passed along to the glpVault as sbfGMX if they're staked
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(sbfGmxBalanceAfter.gt(sbfGmxBalanceBefore)).to.eq(true);
      const gmxAccount = { owner: gmxVault.address, number: ZERO_BI };
      expect((await core.dolomiteMargin.getAccountWei(gmxAccount, underlyingGmxMarketId)).value).to.be.gt(gmxAmount);
    });

    it('should work when assets are claimed and not staked and deposited into Dolomite', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewardsWithSpecificDepositAccountNumber(
        true,
        false,
        true,
        false,
        true,
        true,
        true,
        accountNumber,
      );

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(ZERO_BI)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      const account = { owner: core.hhUser1.address, number: accountNumber };
      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
      expect(balance2.sign).to.eq(true);
      expect(balance2.value.eq(ZERO_BI)).to.eq(false);
    });

    it('should work when assets are not claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await waitDays(30);
      await glpVault.handleRewardsWithSpecificDepositAccountNumber(
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        accountNumber,
      );

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      const account = { owner: core.hhUser1.address, number: accountNumber };
      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      const balance2 = await core.dolomiteMargin.getAccountWei(account, core.marketIds.weth);
      expect(balance2.sign).to.eq(false);
      expect(balance2.value).to.eq(ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      await expectThrow(
        glpVault.callHandleRewardsWithSpecificDepositAccountNumberAndTriggerReentrancy(
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          accountNumber,
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2)
          .handleRewardsWithSpecificDepositAccountNumber(
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            accountNumber,
          ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when attempting to deposit WETH when not claiming', async () => {
      await waitDays(30);
      await expectThrow(
        glpVault.handleRewardsWithSpecificDepositAccountNumber(
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          accountNumber,
        ),
        'GLPIsolationModeTokenVaultV2: Can only deposit ETH if claiming',
      );
    });
  });

  describe('#stakeGmx', () => {
    it('should fail when not called by gmxVault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).stakeGmx(gmxAmount),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#unstakeGmx', () => {
    it('should fail when not called by gmx glpVault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).unstakeGmx(gmxAmount),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#stakeEsGmx', () => {
    it('should work when GMX is vesting', async () => {
      await doHandleRewardsWithWaitTime(30);

      const esGmx = core.gmxEcosystem!.esGmx;
      const originalBalance = await esGmx.balanceOf(glpVault.address);
      await glpVault.stakeEsGmx(esGmxAmount);
      expect(await glpVault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem!.sGmx.depositBalances(glpVault.address, esGmx.address)).to.eq(esGmxAmount);
      expect(await esGmx.balanceOf(glpVault.address)).to.eq(originalBalance.sub(esGmxAmount));
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(esGmxAmount);
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).stakeEsGmx(esGmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstakeEsGmx', () => {
    it('should work normally', async () => {
      await doHandleRewardsWithWaitTime(30);

      const esGmx = core.gmxEcosystem!.esGmx;
      const originalBalance = await esGmx.balanceOf(glpVault.address);
      await glpVault.stakeEsGmx(esGmxAmount);

      await glpVault.unstakeEsGmx(esGmxAmount);
      expect(await glpVault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem!.sGmx.depositBalances(glpVault.address, esGmx.address)).to.eq(ZERO_BI);
      expect(await esGmx.balanceOf(glpVault.address)).to.eq(originalBalance);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).unstakeEsGmx(esGmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#vestGlp', () => {
    it('should work normally', async () => {
      expect(await glpVault.getGlpAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(ZERO_BI);
      await doHandleRewardsWithWaitTime(30);
      const glpAmountVested = await glpVault.getGlpAmountNeededForEsGmxVesting(esGmxAmount);
      await glpVault.vestGlp(esGmxAmount);
      const amountInVesting = await core.gmxEcosystem!.vGlp.pairAmounts(glpVault.address);
      // the amount of GLP in the glpVault should be unchanged if some of it moves into vesting
      expect(amountInVesting).to.eq(glpAmountVested);
      expect(await glpVault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(glpVault.address)).to.eq(amountWei.sub(amountInVesting));
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).vestGlp(esGmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unvestGlp', () => {
    it('should work GLP is staked and no gmxVault exists', async () => {
      await doHandleRewardsWithWaitTime(30);
      await glpVault.vestGlp(esGmxAmount);
      await waitDays(366);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await glpVault.unvestGlp(true);
      expect((await glpVault.gmxBalanceOf()).eq(ZERO_BI)).to.eq(false);

      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, gmxVaultAddress, 0, underlyingGmxMarketId, esGmxAmount);
      expect(await glpVault.hasSynced()).to.be.true;
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).eq(ZERO_BI)).to.eq(false);
      expect((await core.tokens.gmx!.balanceOf(glpVault.address))).to.eq(ZERO_BI);
      expect((await core.tokens.gmx!.balanceOf(core.hhUser1.address))).to.eq(ZERO_BI);
    });

    it('should work GLP is withdrawn and no gmxVault exists', async () => {
      await doHandleRewardsWithWaitTime(30);
      await glpVault.vestGlp(esGmxAmount);
      await waitDays(366);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await glpVault.unvestGlp(false);
      expect(await glpVault.gmxBalanceOf()).to.eq(esGmxAmount);

      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, gmxVaultAddress, 0, underlyingGmxMarketId, esGmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(esGmxAmount);
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVaultAddress)).to.eq(ZERO_BI);
    });

    it('should work GLP is staked and gmxVault exists', async () => {
      await gmxFactory.createVault(core.hhUser1.address);
      await doHandleRewardsWithWaitTime(30);
      await glpVault.vestGlp(esGmxAmount);
      await waitDays(366);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await glpVault.unvestGlp(true);
      expect((await glpVault.gmxBalanceOf()).eq(ZERO_BI)).to.eq(false);

      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, gmxVaultAddress, 0, underlyingGmxMarketId, esGmxAmount);
      expect(await glpVault.hasSynced()).to.be.true;
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).eq(ZERO_BI)).to.eq(false);
      expect((await core.tokens.gmx!.balanceOf(glpVault.address))).to.eq(ZERO_BI);
      expect((await core.tokens.gmx!.balanceOf(core.hhUser1.address))).to.eq(ZERO_BI);
    });

    it('should work GLP is withdrawn and gmxVault exists', async () => {
      await gmxFactory.createVault(core.hhUser1.address);
      await doHandleRewardsWithWaitTime(30);
      await glpVault.vestGlp(esGmxAmount);
      await waitDays(366);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await glpVault.unvestGlp(false);
      expect(await glpVault.gmxBalanceOf()).to.eq(esGmxAmount);

      const gmxVaultAddress = await gmxFactory.calculateVaultByAccount(core.hhUser1.address);
      await expectProtocolBalance(core, gmxVaultAddress, 0, underlyingGmxMarketId, esGmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(esGmxAmount);
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVaultAddress)).to.eq(ZERO_BI);
    });

    it('should fail when not called by glpVault owner', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).unvestGlp(false),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#vestGmx', () => {
    it('should fail when not called by gmxVault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).vestGmx(esGmxAmount),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#unvestGmx', () => {
    it('should fail when not called by gmxVault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).unvestGmx(true, true),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#acceptFullAccountTransfer', () => {
    it('should work when the glpVault has had no interactions with GMX and gmxVault does not exist', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV2.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await newVault.acceptFullAccountTransfer(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work when the glpVault has had no interactions with GMX and gmxVault does exist', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV2.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work if glpVault is created after gmxVault', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV2.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).signalTransfer(vaultAddress);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );

      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work if gmxVault is already created and synced', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV2.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser1).signalTransfer(vaultAddress);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should fail when triggered more than once on the same glpVault', async () => {
      await core.gmxEcosystem!.esGmxDistributorForStakedGlp.setTokensPerInterval('0');
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser2, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser2.address);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser2).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV1>(
        vaultAddress,
        GLPIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );
      expect(await newVault.hasAcceptedFullAccountTransfer()).to.eq(false);
      await newVault.acceptFullAccountTransfer(core.hhUser2.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).to.eq(ZERO_BI);

      expect(await newVault.hasAcceptedFullAccountTransfer()).to.eq(true);

      await setupUSDCBalance(core, core.hhUser2, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );

      await core.gmxEcosystem!.gmxRewardsRouterV2.connect(core.hhUser2).signalTransfer(vaultAddress);
      await expectThrow(
        newVault.acceptFullAccountTransfer(core.hhUser2.address),
        'GLPIsolationModeTokenVaultV2: Cannot transfer more than once',
      );
    });

    it('should fail when sender is the zero address', async () => {
      await expectThrow(
        glpVault.acceptFullAccountTransfer(ZERO_ADDRESS),
        'GLPIsolationModeTokenVaultV2: Invalid sender',
      );
    });

    it('should fail when reentrancy is triggered in the user glpVault', async () => {
      await expectThrow(
        glpVault.callAcceptFullAccountTransferAndTriggerReentrancy(core.hhUser1.address),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when not called by glpVault owner or factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).acceptFullAccountTransfer(core.hhUser2.address),
        `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by glpVault factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await glpVault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await glpVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.equal(glpAmount);
    });

    it('should work when GLP needs to be un-vested', async () => {
      expect(await core.tokens.gmx!.balanceOf(core.hhUser1.address)).to.equal(ZERO_BI);
      await doHandleRewardsWithWaitTime(30);
      const esGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address);
      await glpVault.vestGlp(esGmxAmount);
      await waitDays(366); // vest the GLP

      const glpInVesting = await core.gmxEcosystem!.vGlp.pairAmounts(glpVault.address);
      expect(glpInVesting.eq(ZERO_BI)).to.eq(false);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(glpVault.address)).to.eq(amountWei.sub(glpInVesting));
      const gmxVaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);

      await glpVault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await glpVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.equal(glpAmount);
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.equal(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVaultAddress)).to.eq(ZERO_BI);
    });

    it('should fail when not called by glpVault factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#sync', () => {
    it('should fail if already synced', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      await expectThrow(
        glpVault.connect(factoryImpersonator).sync(gmxVault.address),
        'GLPIsolationModeTokenVaultV2: Already synced',
      );
    });

    it('should fail when not called by gmx glpVault factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).sync(core.hhUser1.address),
        `GLPIsolationModeTokenVaultV2: Only GMX factory can sync <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#sweep', () => {
    it('should work normally', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      await setupGMXBalance(core, core.hhUser1, gmxAmount, glpVault);
      await core.tokens.gmx!.connect(core.hhUser1).transfer(glpVault.address, gmxAmount);

      const gmxVaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
      const gmxVaultImpersonator = await impersonate(gmxVaultAddress, true);
      await glpVault.connect(gmxVaultImpersonator).sweepGmxTokensIntoGmxVault();

      await expectProtocolBalance(core, gmxVaultAddress, 0, underlyingGmxMarketId, gmxAmount);
    });

    it('should work when there is no balance in there', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        gmxVaultAddress,
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      await expectWalletBalance(gmxVault, core.tokens.gmx!, ZERO_BI);

      const gmxVaultImpersonator = await impersonate(gmxVaultAddress, true);
      await glpVault.connect(gmxVaultImpersonator).sweepGmxTokensIntoGmxVault();

      await expectProtocolBalance(core, gmxVaultAddress, accountNumber, underlyingGmxMarketId, ZERO_BI);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should fail if not called by gmxVault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).sweepGmxTokensIntoGmxVault(),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#gmxRewardsRouter', () => {
    it('should work normally', async () => {
      expect(await glpVault.gmxRewardsRouter()).to.equal(core.gmxEcosystem!.gmxRewardsRouterV2.address);
    });
  });

  describe('#underlyingBalanceOf', () => {
    it('should work when funds are only in glpVault', async () => {
      expect(await glpVault.underlyingBalanceOf()).to.equal(amountWei);
    });

    it('should work when funds are in glpVault and vesting', async () => {
      await doHandleRewardsWithWaitTime(30);
      const esGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address);
      await glpVault.vestGlp(esGmxAmount);
      expect(await glpVault.underlyingBalanceOf()).to.equal(amountWei); // amount should be unchanged
    });
  });

  describe('#gmxBalanceOf', () => {
    it('should work when GMX is vesting and staked', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(ZERO_BI, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
    });

    it('should work when GMX is vesting, staked, and idle', async () => {
      await gmxFactory.connect(core.hhUser1).createVault(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser1.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(ZERO_BI, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
    });

    it('should work when no GMX is deposited at all', async () => {
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
    });
  });

  describe('#maxGmxUnstakeAmount', () => {
    it('should fail if not called by gmx vault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).maxGmxUnstakeAmount(),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault',
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await glpVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });
});

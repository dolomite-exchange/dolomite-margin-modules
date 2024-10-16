import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  ADDRESS_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
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
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
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
  IGMXIsolationModeVaultFactory,
  IGmxRegistryV1,
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
import { hrtime } from 'process';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const gmxRewardAmount = parseEther('80'); // Usually is around 85 or so

const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;

describe('GLPIsolationModeTokenVaultV2_rewardRouterV4', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let underlyingGlpMarketId: BigNumber;
  let underlyingGmxMarketId: BigNumber;
  let glpAmount: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let account: AccountInfoStruct;

  before(async () => {
    hre.tracer.enabled = false;
    core = await setupCoreProtocol({
      blockNumber: 264_478_882,
      network: Network.ArbitrumOne,
    });
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry;
    await gmxRegistry.connect(core.governance).ownerSetGmxRewardsRouter(core.gmxEcosystem!.gmxRewardsRouterV4.address);

    const vaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    glpFactory = core.gmxEcosystem!.live.dGlp;
    await glpFactory.connect(core.governance).setUserVaultImplementation(vaultImplementation.address);
    await glpFactory.connect(core.governance).setGmxRegistry(gmxRegistry.address);

    const gmxVaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = core.gmxEcosystem!.live.dGmx;
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);

    underlyingGlpMarketId = BigNumber.from(core.marketIds.dfsGlp!);
    underlyingGmxMarketId = BigNumber.from(core.marketIds.dGmx!)

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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function freezeVault() {
    let gmxVaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
    if (gmxVaultAddress === ADDRESS_ZERO) {
      await gmxFactory.createVault(core.hhUser1.address);
    }
    gmxVaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
    const gmxVault = GMXIsolationModeTokenVaultV1__factory.connect(gmxVaultAddress, core.hhUser1);
    await gmxVault.requestAccountTransfer(core.hhUser1.address);
  }

  async function expectVaultIsFrozen(promiseFn: Promise<any>) {
    await expectThrow(
      promiseFn,
      'IsolationModeVaultV1Freezable: Vault is frozen'
    );
  }

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

    it.only('should work when assets are claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await freezeOraclePrice(core, gmxFactory.address);
      await waitDays(30);
      hre.tracer.enabled = true;
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        false,
      );
      hre.tracer.enabled = false;
      console.log(await core.tokens.gmx.balanceOf(gmxVault.address));
      console.log(await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address));

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
      // await expectProtocolBalance(
      //   core,
      //   gmxVault.address,
      //   accountNumber,
      //   underlyingGmxMarketId,
      //   gmxAmount.add(rewardAmount),
      // );
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

    it('should fail when vault is frozen', async () => {
      await freezeVault();
      await expectVaultIsFrozen(
        glpVault.handleRewards(
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ),
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

    it('should fail when vault is frozen', async () => {
      await freezeVault();
      await expectVaultIsFrozen(
        glpVault.handleRewardsWithSpecificDepositAccountNumber(
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          0,
        ),
      );
    });
  });
});

async function freezeOraclePrice(core: CoreProtocolArbitrumOne, token: string) {
  const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token);
  const price = await core.dolomiteMargin.getMarketPrice(marketId);
  await core.testEcosystem?.testPriceOracle.setPrice(token, price.value);
  await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
}
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
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  IGmxRegistryV1,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
} from '../src/types';
import {
  createGMXIsolationModeTokenVaultV1,
  createTestGLPIsolationModeTokenVaultV2,
} from './glp-ecosystem-utils';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens

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
    underlyingGmxMarketId = BigNumber.from(core.marketIds.dGmx!);

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

    it('should work when assets are claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await freezeOraclePrice(core, gmxFactory.address);
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
      const gmxRewardAmount = (await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).sub(gmxAmount);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingGmxMarketId,
        gmxAmount.add(gmxRewardAmount),
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
        gmxAmount.add(rewardAmount).add(gmxRewardAmount),
      );
      await expectWalletBalance(gmxVault.address, core.tokens.gmx!, ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(rewardAmount).add(gmxRewardAmount));
    });

    it('should work when gmx is claimed and staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();

      await freezeOraclePrice(core, gmxFactory.address);
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
      const gmxRewardAmount = (await core.gmxEcosystem.sbfGmx.balanceOf(glpVault.address)).sub(gmxAmount);

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
        gmxAmount.add(rewardAmount).add(gmxRewardAmount),
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


import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IERC4626,
  IPlutusVaultGLP__factory,
  IPlutusVaultGLPFarm,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPPriceOracle,
  PlutusVaultRegistry,
} from '../src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createPlutusVaultGLPIsolationModeTokenVaultV1,
  createPlutusVaultGLPIsolationModeUnwrapperTraderV1,
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultGLPIsolationModeWrapperTraderV1,
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultRegistry,
} from './plutus-ecosystem-utils';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { createAndSetPlutusVaultWhitelist } from '@dolomite-exchange/modules-plutus/test/plutus-utils';

const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 plvGLP tokens
const stakedAmountWei = amountWei.mul(2).div(3); // 833.3333 plvGLP tokens
const unstakedAmountWei = amountWei.sub(stakedAmountWei); // 416.6666 plvGLP tokens

const accountNumber = ZERO_BI;

describe('PlutusVaultGLPIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC4626;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
  let wrapper: PlutusVaultGLPIsolationModeWrapperTraderV1;
  let priceOracle: PlutusVaultGLPPriceOracle;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let underlyingMarketId: BigNumber;
  let account: AccountInfoStruct;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPlutusVaultGLPIsolationModeTokenVaultV1(core);
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPlutusVaultGLPIsolationModeUnwrapperTraderV1(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPIsolationModeWrapperTraderV1(core, plutusVaultRegistry, factory);
    priceOracle = await createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PlutusVaultGLPIsolationModeTokenVaultV1>(
      vaultAddress,
      PlutusVaultGLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    account = { owner: vault.address, number: accountNumber };

    await createAndSetPlutusVaultWhitelist(core, core.plutusEcosystem!.plvGlpFarm, unwrapper, wrapper, factory, vault);
    await createAndSetPlutusVaultWhitelist(
      core,
      core.plutusEcosystem!.plvGlpRouter,
      unwrapper,
      wrapper,
      factory,
      vault
    );

    const usdcAmount = amountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    const glpAmount = amountWei.mul(4);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
    await core.plutusEcosystem!.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value)
      .to
      .eq(amountWei);
    expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
    expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

    const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
    expect(glpProtocolBalance.sign).to.eq(true);
    expect(glpProtocolBalance.value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#stakePlvGlp', () => {
    it('should work normally', async () => {
      await vault.unstakePlvGlp(stakedAmountWei);
      await expectWalletBalance(vault, underlyingToken, stakedAmountWei);

      await vault.stakePlvGlp(stakedAmountWei);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(amountWei);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).stakePlvGlp(stakedAmountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#harvest', () => {
    it('should work normally', async () => {
      await waitDays(10);
      expect(await rewardToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await rewardToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      await vault.harvest();
      expect(await rewardToken.balanceOf(core.hhUser1.address)).to.not.eq(ZERO_BI);
      expect(await rewardToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).harvest(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstakePlvGlp', () => {
    it('should work normally', async () => {
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(amountWei);

      await vault.unstakePlvGlp(unstakedAmountWei);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).unstakePlvGlp(stakedAmountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by vault factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await vault.unstakePlvGlp(amountWei);
      const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
      await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(ZERO_BI);
      expect((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
    });

    it('should work when plvGLP needs to be un-staked', async () => {
      const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(amountWei);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(amountWei);

      await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.equal(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(ZERO_BI);
    });

    it('should work when plvGLP needs to be un-staked and rewards are paused', async () => {
      const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(amountWei);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(amountWei);

      const farmOwner = await impersonate(await farm.owner(), true);
      await farm.connect(farmOwner).setPaused(true);
      expect(await farm.paused()).to.be.true;

      await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.equal(ZERO_BI);
      expect((await farm.userInfo(vault.address))._balance).to.eq(ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(ZERO_BI);
    });

    it('should fail when not called by vault factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#plvGlpFarm', () => {
    it('should work normally', async () => {
      expect(await vault.plvGlpFarm()).to.equal(core.plutusEcosystem!.plvGlpFarm.address);
    });
  });

  describe('#pls', () => {
    it('should work normally', async () => {
      expect(await vault.pls()).to.equal(core.plutusEcosystem!.plsToken.address);
    });
  });

  describe('#underlyingBalanceOf', () => {
    it('should work when funds are only in vault', async () => {
      await vault.unstakePlvGlp(amountWei);
      expect(await vault.underlyingBalanceOf()).to.equal(amountWei);
    });

    it('should work when funds are in vault and staked', async () => {
      expect(await vault.underlyingBalanceOf()).to.equal(amountWei); // amount should be unchanged
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should work vault params are set to false', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const plvGlp = IPlutusVaultGLP__factory.connect(await plutusVaultRegistry.plvGlpToken(), core.hhUser1);
      const owner = await impersonate(await plvGlp.owner(), true);
      const canDoAnything = false;
      await plvGlp.connect(owner).setParams(canDoAnything, canDoAnything, canDoAnything, canDoAnything);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});

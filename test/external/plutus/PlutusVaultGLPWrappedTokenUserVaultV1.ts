import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IERC4626, IPlutusVaultGLP__factory,
  IPlutusVaultGLPFarm,
  PlutusVaultGLPPriceOracle,
  PlutusVaultGLPUnwrapperTrader,
  PlutusVaultGLPWrappedTokenUserVaultFactory,
  PlutusVaultGLPWrappedTokenUserVaultV1,
  PlutusVaultGLPWrappedTokenUserVaultV1__factory,
  PlutusVaultGLPWrapperTrader,
  PlutusVaultRegistry,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot, waitDays } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import {
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultGLPUnwrapperTrader,
  createPlutusVaultGLPWrappedTokenUserVaultFactory,
  createPlutusVaultGLPWrappedTokenUserVaultV1,
  createPlutusVaultGLPWrapperTrader,
  createPlutusVaultRegistry,
} from '../../utils/wrapped-token-utils';
import { createAndSetPlutusVaultWhitelist } from './plutus-utils';

const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 plvGLP tokens
const stakedAmountWei = amountWei.mul(2).div(3); // 833.3333 plvGLP tokens
const unstakedAmountWei = amountWei.sub(stakedAmountWei); // 416.6666 plvGLP tokens

const accountNumber = ZERO_BI;

describe('PlutusVaultGLPWrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPUnwrapperTrader;
  let wrapper: PlutusVaultGLPWrapperTrader;
  let priceOracle: PlutusVaultGLPPriceOracle;
  let factory: PlutusVaultGLPWrappedTokenUserVaultFactory;
  let vault: PlutusVaultGLPWrappedTokenUserVaultV1;
  let underlyingMarketId: BigNumber;
  let account: Account.InfoStruct;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPlutusVaultGLPWrappedTokenUserVaultV1();
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = await createPlutusVaultGLPWrappedTokenUserVaultFactory(
      core,
      plutusVaultRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPlutusVaultGLPUnwrapperTrader(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPWrapperTrader(core, plutusVaultRegistry, factory);
    priceOracle = await createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PlutusVaultGLPWrappedTokenUserVaultV1>(
      vaultAddress,
      PlutusVaultGLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );
    account = { owner: vault.address, number: accountNumber };

    const usdcAmount = amountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.usdc.address, usdcAmount, 0, 0);
    const glpAmount = amountWei.mul(4);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
    await core.plutusEcosystem!.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect(await vault.underlyingBalanceOf()).to.eq(amountWei);

    await createAndSetPlutusVaultWhitelist(core, core.plutusEcosystem!.plvGlpFarm, unwrapper, wrapper, factory);
    await createAndSetPlutusVaultWhitelist(core, core.plutusEcosystem!.plvGlpRouter, unwrapper, wrapper, factory);

    const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
    expect(glpProtocolBalance.sign).to.eq(true);
    expect(glpProtocolBalance.value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#stakePlvGlp', () => {
    it('should work normally', async () => {
      await vault.stakePlvGlp(stakedAmountWei);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).stakePlvGlp(stakedAmountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#harvest', () => {
    it('should work normally', async () => {
      await vault.stakePlvGlp(stakedAmountWei);
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
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstakePlvGlp', () => {
    it('should work normally', async () => {
      await vault.stakePlvGlp(stakedAmountWei);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);

      await vault.unstakePlvGlp(unstakedAmountWei);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei.mul(2));
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei.sub(unstakedAmountWei));
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).unstakePlvGlp(stakedAmountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
      await vault.withdrawFromVaultForDolomiteMargin(accountNumber, amountWei);
      expect(await vault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect((await core.dolomiteMargin.getAccountWei(account, underlyingMarketId)).value).to.equal(ZERO_BI);
      expect((await underlyingToken.balanceOf(core.hhUser1.address)).sub(balanceBefore)).to.equal(amountWei);
    });

    it('should work when plvGLP needs to be un-staked', async () => {
      const balanceBefore = await underlyingToken.balanceOf(core.hhUser1.address);
      await vault.stakePlvGlp(stakedAmountWei);

      // balance should not have changed
      expect(await underlyingToken.balanceOf(core.hhUser1.address)).to.eq(balanceBefore);

      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
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
      await vault.stakePlvGlp(stakedAmountWei);

      // balance should not have changed
      expect(await underlyingToken.balanceOf(core.hhUser1.address)).to.eq(balanceBefore);

      expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(unstakedAmountWei);
      expect((await farm.userInfo(vault.address))._balance).to.eq(stakedAmountWei);
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
        `WrappedTokenUserVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
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
      expect(await vault.underlyingBalanceOf()).to.equal(amountWei);
    });

    it('should work when funds are in vault and staked', async () => {
      await vault.stakePlvGlp(stakedAmountWei);
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

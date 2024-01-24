import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IJonesUSDCRegistry,
  JonesUSDCIsolationModeTokenVaultV2,
  JonesUSDCIsolationModeTokenVaultV2__factory,
  JonesUSDCIsolationModeVaultFactory,
} from '../src/types';
import {
  IERC4626,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithName } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceByTimeDelta, impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createJonesUSDCIsolationModeTokenVaultV2 } from './jones-ecosystem-utils';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);

describe('JonesUSDCIsolationModeTokenVaultV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let marketId: BigNumberish;
  let jonesUSDCRegistry: IJonesUSDCRegistry;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let vault: JonesUSDCIsolationModeTokenVaultV2;
  let governor: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 155_091_000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.jonesEcosystem!.jUSDC.connect(core.hhUser1);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV2();
    jonesUSDCRegistry = core.jonesEcosystem!.live.jonesUSDCRegistry;
    factory = core.jonesEcosystem!.live.jUSDCIsolationModeFactory;
    marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);
    governor = await impersonate('0x4817cA4DF701d554D78Aa3d142b62C162C682ee1', true);

    const newRegistryImplementation = await createContractWithName('JonesUSDCRegistry', []);
    await RegistryProxy__factory.connect(jonesUSDCRegistry.address, core.governance).upgradeTo(
      newRegistryImplementation.address,
    );
    await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDCFarm(
      core.jonesEcosystem!.jUSDCFarm.address,
    );
    await factory.connect(core.governance).ownerSetUserVaultImplementation(
      userVaultImplementation.address,
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV2>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.jonesEcosystem!.glpAdapter);
    await core.jonesEcosystem!.glpAdapter.connect(core.hhUser1).depositStable(usableUsdcAmount, true);
    await core.jonesEcosystem!.jUSDC.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const newBalance = amountWei.mul(99).div(100);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);
      expect(await vault.pendingRewards()).to.be.gt(0);
      expect(await vault.underlyingBalanceOf()).to.eq(newBalance);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should work normally when incentives are disabled', async () => {
      await core.jonesEcosystem!.jUSDCFarm.connect(governor).toggleIncentives();
      expect(await vault.isDepositIncentiveEnabled()).to.be.false;

      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const newBalance = amountWei;
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);
      expect(await vault.pendingRewards()).to.be.gt(0);
      expect(await vault.underlyingBalanceOf()).to.eq(newBalance);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
    });

    it('should fail if the user does not have enough jUSDC for retentions', async () => {
      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const newBalance = amountWei.mul(99).div(100);
      await expectThrow(vault.stake(newBalance));
    });

    it('should work when incentives are off', async () => {
      const testFarm = await createContractWithName('TestJonesUSDCFarm', []);
      await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDCFarm(testFarm.address);

      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const newBalance = amountWei;
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);
      expect(await vault.underlyingBalanceOf()).to.eq(newBalance);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(newBalance); // the test farm doesn't move the assets
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).stake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const newBalance = amountWei.mul(99).div(100);
      await vault.unstake(newBalance);

      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);
      expect(await vault.pendingRewards()).to.eq(0); // unstaking claims any pending rewards
      expect(await vault.underlyingBalanceOf()).to.eq(newBalance);
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(newBalance);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).unstake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#harvestRewards', () => {
    it('should work normally', async () => {
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);

      await vault.stake(amountWei);

      await advanceByTimeDelta(3600);

      const pendingRewards = await vault.pendingRewards();
      expect(pendingRewards).to.be.gt(ZERO_BI);

      await vault.harvestRewards();

      expect(await vault.pendingRewards()).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei.mul(99).div(100));
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);

      const testFarm = await createContractWithName('TestJonesUSDCFarm', []);
      await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDCFarm(testFarm.address);

      await vault.harvestRewards();
      expect(await vault.pendingRewards()).to.eq(ZERO_BI);

      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.arb!,
        ONE_BI,
        0,
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).harvestRewards(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should auto stake when deposit incentives are disabled', async () => {
      await core.jonesEcosystem!.jUSDCFarm.connect(governor).toggleIncentives();
      expect(await vault.isDepositIncentiveEnabled()).to.be.false;

      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await underlyingToken.approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);

      await advanceByTimeDelta(3600);

      expect(await vault.pendingRewards()).to.be.gt(ZERO_BI);
    });

    it('should fail if not called by vault factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally with staked amount and not leave dangling ARB in vault', async () => {
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);

      await vault.stake(amountWei);
      const newBalance = amountWei.mul(99).div(100);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);

      await advanceByTimeDelta(3600);

      expect(await vault.pendingRewards()).to.be.gt(ZERO_BI);

      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
      );
      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, newBalance);

      expect(await vault.pendingRewards()).to.be.gt(ZERO_BI);
      await expectWalletBalance(vault, core.tokens.arb!, ZERO_BI);
    });

    it('should work normally when user needs to withdraw some of their staked amount', async () => {
      await expectProtocolBalance(core, vault, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);

      const stakedBalance = amountWei.div(2).mul(99).div(100);
      await vault.stake(amountWei.div(2));
      const newBalance = amountWei.div(2).add(stakedBalance);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, newBalance);

      await advanceByTimeDelta(3600);

      expect(await vault.pendingRewards()).to.be.gt(ZERO_BI);

      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(4));
      expect(await vault.stakedBalanceOf()).to.eq(stakedBalance);
      expect(await vault.underlyingBalanceOf()).to.eq(newBalance.sub(amountWei.div(4)));
      await expectWalletBalance(vault, underlyingToken, newBalance.sub(stakedBalance).sub(amountWei.div(4)));
    });

    it('should fail if not called by vault factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser2.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });
});

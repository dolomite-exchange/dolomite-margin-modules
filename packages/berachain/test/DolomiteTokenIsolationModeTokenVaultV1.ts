import { DolomiteERC4626, DolomiteERC4626__factory, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createContractWithLibrary, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  DolomiteTokenIsolationModeTokenVaultV1,
  DolomiteTokenIsolationModeTokenVaultV1__factory,
  DolomiteTokenIsolationModeVaultFactory,
  DolomiteTokenIsolationModeVaultFactory__factory,
  IInfraredVault,
  INativeRewardVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';
import { createDolomiteErc4626Proxy, createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

describe('DolomiteTokenIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let factory: BerachainRewardsIsolationModeVaultFactory;

  let dToken: DolomiteERC4626;
  let vault: BerachainRewardsIsolationModeTokenVaultV1;
  let parAmount: BigNumber;

  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 837_000,
      network: Network.Berachain,
    });

    const dTokenProxy = await createDolomiteErc4626Proxy(core.marketIds.honey, core);
    dToken = DolomiteERC4626__factory.connect(dTokenProxy.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const vaultImplementation = await createContractWithLibrary<DolomiteTokenIsolationModeTokenVaultV1>(
      'DolomiteTokenIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createContractWithAbi<DolomiteTokenIsolationModeVaultFactory>(
      DolomiteTokenIsolationModeVaultFactory__factory.abi,
      DolomiteTokenIsolationModeVaultFactory__factory.bytecode,
      [registry.address, dToken.address, core.borrowPositionProxyV2.address, vaultImplementation.address, core.dolomiteMargin.address],
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<DolomiteTokenIsolationModeTokenVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      DolomiteTokenIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupHONEYBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, amountWei);
    parAmount = await dToken.balanceOf(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it.only('should work normally', async () => {
      await dToken.connect(core.hhUser1).approve(vault.address, parAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, parAmount);
    });
  });

  describe('#stake', () => {
    it('should work normally on deposit with native set as default', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should work normally on deposit with infrared set as default', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
    });

    it('should work normally not on deposit with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await beraVault.stake(RewardVaultType.Native, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await nativeRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should work normally not on deposit with infrared', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);

      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
    });

    it('should work normally not on deposit with bgtm', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.stake(RewardVaultType.BGTM, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await nativeRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should switch default type if current default type is empty', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await beraVault.unstake(RewardVaultType.Native, amountWei);

      const res = await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        rewardVaultType: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, underlyingToken.address)).to.eq(
        RewardVaultType.Infrared,
      );

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should fail if type is not default and default has staked amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      await expectWalletBalance(beraVault, underlyingToken, amountWei.div(2));

      await expectThrow(
        beraVault.stake(RewardVaultType.Infrared, amountWei.div(2)),
        'BerachainRewardsMetaVault: Default type must be empty',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).stake(RewardVaultType.Native, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally for native vault', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for infrared vault', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.Infrared, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should work normally for bgtm vault', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await beraVault.unstake(RewardVaultType.BGTM, amountWei);
      expect(await nativeRewardVault.balanceOf(beraVault.address)).to.equal(ZERO_BI);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).unstake(RewardVaultType.Native, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally for native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();
      expect(await core.tokens.bgt.balanceOf(metaVaultAddress)).to.be.gt(0);
      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
    });

    it('should work normally for infrared', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);

      await beraVault.exit();

      // The iBGT vault is now created since we called Exit
      iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      expect(await underlyingToken.balanceOf(beraVault.address)).to.eq(amountWei);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: iBgtVault.address, number: defaultAccountNumber },
        iBgtMarketId,
        ONE_BI,
        ZERO_BI,
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        beraVault.connect(core.hhUser2).exit(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally and stake into reward vault', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.usdc, ZERO_BI);
      await depositIntoDolomiteMargin(core, core.hhUser1, 0, core.marketIds.usdc, usdcAmount);
      const parAmount = BigNumber.from('50000000');
      await dToken.approve(vault.address, parAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, parAmount);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally if need to unstake full amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if need to unstake partial amount', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei.div(2));
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei.div(2));
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally if no unstaking has to occur', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.unstake(RewardVaultType.Native, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);

      await beraVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await nativeRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail if not called from factory', async () => {
      await expectThrow(
        beraVault.executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await beraVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await beraVault.registry()).to.equal(registry.address);
    });
  });
});

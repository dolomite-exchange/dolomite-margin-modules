import {
  DolomiteERC4626,
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  IInfraredVault,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x4Be03f781C497A489E3cB0287833452cA9B9E80B';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('InfraredBGTMetaVault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let dolomiteTokenImplementation: DolomiteERC4626;
  let dolomiteToken: DolomiteERC4626;

  let underlyingToken: IERC20;
  let infraredRewardVault: IInfraredVault;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;

  let iBgtMarketId: BigNumber;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_303_800,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    await setEtherBalance(core.governance.address, parseEther('100'));
    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metaVault = BerachainRewardsMetaVault__factory.connect(
      await registry.getMetaVaultByAccount(core.hhUser1.address),
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS, true);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await metaVault.OWNER()).to.eq(core.hhUser1.address);
      expect(await metaVault.REGISTRY()).to.eq(registry.address);
    });
  });

  xdescribe('#stakeDolomiteToken', () => {
    it('should fail if token is not listed on BGT Station', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteToken.address, true);
      await expectThrow(metaVault.stakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei));
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).stakeDolomiteToken(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });

    it('should fail if the token is not valid', async () => {
      await expectThrow(
        metaVault.stakeDolomiteToken(dolomiteTokenImplementation.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );

      await expectThrow(
        metaVault.stakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );
    });
  });

  xdescribe('#unstakeDolomiteToken', () => {
    it('should fail if token is not listed on BGT Station', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteToken.address, true);
      await expectThrow(metaVault.unstakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei));
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        metaVault
          .connect(core.hhUser2)
          .unstakeDolomiteToken(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });

    it('should fail if the token is not valid', async () => {
      await expectThrow(
        metaVault.unstakeDolomiteToken(dolomiteTokenImplementation.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );

      await expectThrow(
        metaVault.unstakeDolomiteToken(dolomiteToken.address, RewardVaultType.Native, amountWei),
        'BerachainRewardsMetaVault: Invalid Dolomite token',
      );
    });
  });

  describe('#stake', () => {
    it('should work normally (infrared is default)', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await infraredRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
    });

    it('should work normally not on deposit with infrared', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await beraVault.unstake(RewardVaultType.Infrared, amountWei);

      await beraVault.stake(RewardVaultType.Infrared, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, ZERO_BI);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(amountWei);
    });

    it('should fail if not infrared', async () => {
      await expectThrow(
        beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'Token: transferFrom failed', // bubbled up from Only infrared is supported
      );
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).stake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally with infrared', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await beraVault.unstake(RewardVaultType.Infrared, amountWei);
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);
      expect(await infraredRewardVault.balanceOf(metaVault.address)).to.equal(ZERO_BI);
    });

    it('should fail if not infrared', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectThrow(
        beraVault.unstake(RewardVaultType.Native, amountWei),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).unstake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#setDefaultRewardVaultTypeByAsset', () => {
    it('should work normally', async () => {
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Native);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Infrared);
    });

    it('should fail if not infrared', async () => {
      await expectThrow(
        metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM),
        'InfraredBGTMetaVault: Only infrared is supported',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault
          .connect(core.hhUser2)
          .setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared),
        `InfraredBGTMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with infrared', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const balance = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.equal(balance);
      expect(await core.tokens.iBgt.balanceOf(metaVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, balance);
    });

    it('should work normally with infrared if vault is already created', async () => {
      await iBgtFactory.createVault(core.hhUser1.address);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const balance = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.equal(balance);
      expect(await core.tokens.iBgt.balanceOf(metaVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, balance);
    });

    it('should work if no rewards are available', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await metaVault.getReward(underlyingToken.address);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, iBgtMarketId, ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).getReward(underlyingToken.address),
        `InfraredBGTMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work if rewards are available', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await increase(10 * ONE_DAY_SECONDS);
      await beraVault.exit();
      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      await expectWalletBalance(beraVault, underlyingToken, amountWei);

      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const balance = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.equal(balance);
      expect(await core.tokens.iBgt.balanceOf(metaVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, balance);
    });

    it('should work if no rewards are available', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await beraVault.exit();
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).exit(underlyingToken.address),
        `InfraredBGTMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });
});

import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  IERC20,
  TestDolomiteERC4626,
} from '@dolomite-exchange/modules-base/src/types';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  TWO_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AbiCoder, defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createDolomiteErc4626Proxy } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  BGTIsolationModeVaultFactory,
  BGTMERC20Wrapper,
  BGTMERC20Wrapper__factory,
  BGTMIsolationModeTokenVaultV1,
  BGTMIsolationModeTokenVaultV1__factory,
  BGTMIsolationModeVaultFactory,
  IBgtMetaVault,
  IBgtMetaVault__factory,
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
  createBGTMIsolationModeTokenVaultV1,
  createBGTMIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
  setupUserMetaVault,
} from './berachain-ecosystem-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x4Be03f781C497A489E3cB0287833452cA9B9E80B';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

describe('BerachainRewardsMetaVault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let bgtmFactory: BGTMIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let dolomiteTokenImplementation: DolomiteERC4626;
  let dolomiteToken: DolomiteERC4626;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredVault;
  let bgtmWrapper: BGTMERC20Wrapper;

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metaVault: BerachainRewardsMetaVault;
  let bgtVault: BGTIsolationModeTokenVaultV1;
  let bgtmVault: BGTMIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;
  let bgtmMarketId: BigNumber;
  let iBgtMarketId: BigNumber;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_303_800,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metaVaultImplementation = await createContractWithAbi<IBgtMetaVault>(
      IBgtMetaVault__factory.abi,
      IBgtMetaVault__factory.bytecode,
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

  describe.only('#stake', () => {
    it('should work normally (infrared is default)', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const metaVaultAddress = await registry.getMetaVaultByAccount(core.hhUser1.address);

      await expectProtocolBalance(core, beraVault, defaultAccountNumber, marketId, amountWei);
      expect(await infraredRewardVault.balanceOf(metaVaultAddress)).to.equal(amountWei);
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

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser1).stake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).unstake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#setDefaultRewardVaultTypeByAsset', () => {
    it('should work normally', async () => {
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Native);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.Infrared);
    });

    it('should work if it sets operator on BGT multiple times', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      expect(await metaVault.getDefaultRewardVaultTypeByAsset(underlyingToken.address)).to.eq(RewardVaultType.BGTM);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metaVault
          .connect(core.hhUser2)
          .setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared),
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const bal = await core.tokens.bgt.balanceOf(metaVault.address);
      expect(bal).to.gt(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await metaVault.bgtBalanceOf()).to.equal(bal);
      expect(await bgtVault.underlyingBalanceOf()).to.equal(bal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
    });

    it('should work normally with bgtm', async () => {
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.BGTM);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      const bal = await bgtmWrapper.balanceOf(metaVault.address);
      expect(bal).to.gt(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei);
      expect(await metaVault.bgtmBalanceOf()).to.equal(bal);
      expect(await bgtmVault.underlyingBalanceOf()).to.equal(bal);
      await expectProtocolBalance(core, bgtmVault, defaultAccountNumber, bgtmMarketId, bal);
    });

    it('should work normally with infrared', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(4));
      await increase(10 * ONE_DAY_SECONDS);
      await metaVault.getReward(underlyingToken.address);

      await iBgtFactory.createVault(core.hhUser1.address);
      const iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
        await iBgtFactory.getVaultByAccount(core.hhUser1.address),
        InfraredBGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      const balance = await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address);
      expect(await beraVault.underlyingBalanceOf()).to.equal(amountWei.div(4));
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
        `BerachainRewardsMetaVault: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work if no rewards are available', async () => {
      const metaVault = await setupUserMetaVault(core.hhUser1, registry);
      await metaVault.setDefaultRewardVaultTypeByAsset(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await beraVault.exit();
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, iBgtMarketId, ZERO_BI);
    });

    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metaVault.connect(core.hhUser2).exit(underlyingToken.address),
        `BerachainRewardsMetaVault: Only child vault can call <${core.hhUser2.addressLower}>`,
      );
    });
  });
});

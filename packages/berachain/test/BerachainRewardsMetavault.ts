import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  INativeRewardVault,
  IInfraredRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory,
} from '../src/types';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
} from './berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

enum RewardVaultType {
  Native,
  Infrared,
}

describe('BerachainRewardsMetavault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let underlyingToken: IERC20;
  let beraRegistry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metavault: BerachainRewardsMetavault;

  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;
  let marketId: BigNumber;
  let ibgtMarketid: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    ibgtMarketid = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.ibgt.address, ONE_ETH_BI);
    await setupTestMarket(core, core.tokens.ibgt, false);

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    const metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    beraRegistry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
    await beraRegistry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Native,
      nativeRewardVault.address
    );
    await beraRegistry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Infrared,
      infraredRewardVault.address
    );

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      beraRegistry,
      underlyingToken,
      vaultImplementation,
      core,
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, amountWei);
    await setupTestMarket(core, beraFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metavault = BerachainRewardsMetavault__factory.connect(
      await beraRegistry.getAccountToMetavault(core.hhUser1.address),
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await metavault.OWNER()).to.eq(core.hhUser1.address);
      expect(await metavault.registry()).to.eq(beraRegistry.address);
    });
  });

  describe('#stake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).stake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).unstake(underlyingToken.address, RewardVaultType.Native, amountWei),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally with native', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect(await core.tokens.bgt.balanceOf(metavault.address)).to.gt(ZERO_BI);
    });

    it('should work normally with infrared', async () => {
      await beraRegistry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(4));
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Infrared);

      expect(await beraVault.underlyingBalanceOf()).to.equal(ZERO_BI);
      expect(await core.tokens.ibgt.balanceOf(metavault.address)).to.eq(ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        ibgtMarketid,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work if no rewards are available', async () => {
      await beraRegistry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_BI);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Infrared);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, ibgtMarketid, ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).getReward(underlyingToken.address, RewardVaultType.Native),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should fail if not called by child vault', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).exit(underlyingToken.address, RewardVaultType.Native),
        `BerachainRewardsMetavault: Only child vault can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#redeemBGT', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);
      const bal = await core.tokens.bgt.balanceOf(metavault.address);

      await expect(() => metavault.redeemBGT(bal)).to.changeEtherBalance(
        core.hhUser1,
        bal,
      );
      expect(await core.tokens.bgt.balanceOf(metavault.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).redeemBGT(ONE_BI),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#delegateBGT', () => {
    it('should work normally', async () => {
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

      await metavault.delegateBGT(core.hhUser1.address);
      expect(await core.tokens.bgt.delegates(metavault.address)).to.eq(core.hhUser1.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser2).delegateBGT(core.hhUser2.address),
        `BerachainRewardsMetavault: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });
});

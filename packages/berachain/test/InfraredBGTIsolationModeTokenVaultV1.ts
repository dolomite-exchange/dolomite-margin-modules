import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
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
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  IInfraredRewardVault,
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
} from './berachain-ecosystem-utils';

const IBGT_WHALE_ADDRESS = '0x4B95296B937AF613D65206Ba7C203CB9A1263003';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

enum RewardVaultType {
  Native,
  Infrared,
}

describe('InfraredBGTIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let iBgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let iBgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Native, nativeRewardVault.address);
    await registry
      .connect(core.governance)
      .ownerSetRewardVault(underlyingToken.address, RewardVaultType.Infrared, infraredRewardVault.address);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);
    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await iBgtFactory.createVault(core.hhUser1.address);
    iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
      await iBgtFactory.getVaultByAccount(core.hhUser1.address),
      InfraredBGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    const iBgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.iBgt.connect(iBgtWhale).transfer(core.hhUser1.address, amountWei);
    await core.tokens.iBgt.connect(core.hhUser1).approve(iBgtVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#setIsDepositSourceMetaVault', () => {
    it('should work normally', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);

      const res = await iBgtVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      await expectEvent(iBgtVault, res, 'IsDepositSourceMetaVaultSet', {
        isDepositSourceMetaVault: true,
      });
      expect(await iBgtVault.isDepositSourceMetaVault()).to.eq(true);
    });

    it('should fail if not called by metaVault', async () => {
      await expectThrow(iBgtVault.setIsDepositSourceMetaVault(true), 'MetaVaultRewardReceiver: Only metaVault');
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally if user deposits', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should work normally if deposit comes from metaVault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await core.tokens.iBgt.connect(core.hhUser1).transfer(metaVaultImpersonator.address, amountWei);
      await core.tokens.iBgt.connect(metaVaultImpersonator).approve(iBgtVault.address, amountWei);

      await iBgtVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      await iBgtFactory
        .connect(metaVaultImpersonator)
        .depositIntoDolomiteMarginFromMetaVault(core.hhUser1.address, defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally if no unstaking occurs', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await iBgtVault.unstake(amountWei);

      await iBgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.iBgt, amountWei);
    });

    it('should work normally if partial unstaking occurs', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await iBgtVault.unstake(amountWei.div(2));

      await iBgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.iBgt, amountWei);
    });

    it('should work normally if full unstaking occurs', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await iBgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.iBgt, amountWei);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await iBgtVault.unstake(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);

      await iBgtVault.stake(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).stake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await iBgtVault.unstake(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).unstake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(30 * ONE_DAY_SECONDS);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, ZERO_BI);
      await iBgtVault.getReward();
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.honey,
        ONE_BI,
        0,
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).getReward(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await iBgtVault.registry()).to.eq(registry.address);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work normally', async () => {
      expect(await iBgtVault.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
    });
  });
});

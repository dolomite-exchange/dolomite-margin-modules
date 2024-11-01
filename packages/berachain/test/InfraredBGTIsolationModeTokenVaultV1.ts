import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  INativeRewardVault,
  IInfraredRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory,
  BGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  IERC20,
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
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

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
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;
  let infraredRewardVault: IInfraredRewardVault;

  let ibgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let ibgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

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
    registry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Native,
      nativeRewardVault.address
    );
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Infrared,
      infraredRewardVault.address
    );

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(
      registry,
      core.tokens.bgt,
      bgtVaultImplementation,
      core,
    );
    const ibgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    ibgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.ibgt,
      ibgtVaultImplementation,
      core,
    );

    ibgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(ibgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await ibgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ibgtFactory.address);

    await ibgtFactory.createVault(core.hhUser1.address);
    ibgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
      await ibgtFactory.getVaultByAccount(core.hhUser1.address),
      InfraredBGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    const ibgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.ibgt.connect(ibgtWhale).transfer(core.hhUser1.address, amountWei);
    await core.tokens.ibgt.connect(core.hhUser1).approve(ibgtVault.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#setIsDepositSourceMetavault', () => {
    it('should work normally', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const metavaultImpersonator = await impersonate(await registry.getAccountToMetavault(core.hhUser1.address), true);

      const res = await ibgtVault.connect(metavaultImpersonator).setIsDepositSourceMetavault(true);
      await expectEvent(ibgtVault, res, 'IsDepositSourceMetavaultSet', {
        isDepositSourceMetavault: true,
      });
      expect(await ibgtVault.isDepositSourceMetavault()).to.eq(true);
    });

    it('should fail if not called by metavault', async () => {
      await expectThrow(
        ibgtVault.setIsDepositSourceMetavault(true),
        'InfraredBGTUserVaultV1: Only metavault'
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally if user deposits', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(ibgtVault.address)).to.eq(amountWei);
    });

    it('should work normally if deposit comes from metavault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const metavaultImpersonator = await impersonate(await registry.getAccountToMetavault(core.hhUser1.address), true);
      await core.tokens.ibgt.connect(core.hhUser1).transfer(metavaultImpersonator.address, amountWei);
      await core.tokens.ibgt.connect(metavaultImpersonator).approve(ibgtVault.address, amountWei);

      await ibgtVault.connect(metavaultImpersonator).setIsDepositSourceMetavault(true);
      await ibgtFactory.connect(metavaultImpersonator).depositIntoDolomiteMarginFromMetavault(
        core.hhUser1.address,
        defaultAccountNumber,
        amountWei
      );
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(ibgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        ibgtVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally if no unstaking occurs', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await ibgtVault.unstake(amountWei);

      await ibgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.ibgt, amountWei);
    });

    it('should work normally if partial unstaking occurs', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await ibgtVault.unstake(amountWei.div(2));

      await ibgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.ibgt, amountWei);
    });

    it('should work normally if full unstaking occurs', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await ibgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, ibgtVault, defaultAccountNumber, ibgtMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.ibgt, amountWei);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        ibgtVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await ibgtVault.unstake(amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(amountWei);

      await ibgtVault.stake(amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(ibgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        ibgtVault.connect(core.hhUser2).stake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await ibgtVault.unstake(amountWei);
      expect(await ibgtVault.underlyingBalanceOf()).to.eq(amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        ibgtVault.connect(core.hhUser2).unstake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally', async () => {
      await ibgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(30 * ONE_DAY_SECONDS);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, ZERO_BI);
      await ibgtVault.getReward();
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.honey,
        ONE_BI,
        0
      );
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await ibgtVault.registry()).to.eq(registry.address);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work normally', async () => {
      expect(await ibgtVault.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
    });
  });
});

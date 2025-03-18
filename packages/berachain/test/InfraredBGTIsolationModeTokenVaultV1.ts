import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
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
  setupWBERABalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  TestInfraredVault,
  TestInfraredVault__factory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory, createPolLiquidatorProxy,
} from './berachain-ecosystem-utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createLiquidatorProxyV5 } from 'packages/base/test/utils/dolomite';

const IBGT_WHALE_ADDRESS = '0x9b45388Fc442343dE9959D710eB47Da8c09eE2d9';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');
const rewardAmount = parseEther('.25');

describe('InfraredBGTIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let testInfraredVault: TestInfraredVault;

  let iBgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let iBgtMarketId: BigNumber;
  let iBgtWhale: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_342_200,
      network: Network.Berachain,
    });

    const liquidatorProxyV5 = await createLiquidatorProxyV5(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV5);
    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

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

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

    await iBgtFactory.createVault(core.hhUser1.address);
    iBgtVault = setupUserVaultProxy<InfraredBGTIsolationModeTokenVaultV1>(
      await iBgtFactory.getVaultByAccount(core.hhUser1.address),
      InfraredBGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    iBgtWhale = await impersonate(IBGT_WHALE_ADDRESS, true);
    await core.tokens.iBgt.connect(iBgtWhale).transfer(core.hhUser1.address, amountWei);
    await core.tokens.iBgt.connect(core.hhUser1).approve(iBgtVault.address, amountWei);

    testInfraredVault = await createContractWithAbi<TestInfraredVault>(
      TestInfraredVault__factory.abi,
      TestInfraredVault__factory.bytecode,
      [core.tokens.iBgt.address],
    );

    // to avoid price expired errors when advancing time
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.honey.address, ONE_ETH_BI);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.honey,
      core.testEcosystem!.testPriceOracle.address
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#setIsDepositSourceMetaVault', () => {
    it('should work normally', async () => {
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      const res = await iBgtVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      await expectEvent(iBgtVault, res, 'IsDepositSourceMetaVaultSet', {
        isDepositSourceMetaVault: true,
      });
      expect(await iBgtVault.isDepositSourceMetaVault()).to.eq(true);
    });

    it('should fail if not called by metaVault', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser1).setIsDepositSourceMetaVault(true),
        'MetaVaultRewardReceiver: Only metaVault'
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally if user deposits', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should work normally if deposit comes from metaVault', async () => {
      const metaVaultImpersonator = await impersonate(await registry.getMetaVaultByAccount(core.hhUser1.address), true);
      await core.tokens.iBgt.connect(core.hhUser1).transfer(metaVaultImpersonator.address, amountWei);
      await core.tokens.iBgt.connect(metaVaultImpersonator).approve(iBgtVault.address, amountWei);

      await iBgtVault.connect(metaVaultImpersonator).setIsDepositSourceMetaVault(true);
      await iBgtFactory
        .connect(metaVaultImpersonator)
        .depositIntoDolomiteMarginFromMetaVault(core.hhUser1.address, defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
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
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.iBgt.balanceOf(iBgtVault.address)).to.eq(amountWei);

      await iBgtVault.stake(amountWei);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(amountWei);
      expect(await core.tokens.iBgt.balanceOf(iBgtVault.address)).to.eq(ZERO_BI);
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
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
      await iBgtVault.unstake(amountWei);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(ZERO_BI);
      expect(await iBgtVault.underlyingBalanceOf()).to.eq(amountWei);
      expect(await core.tokens.iBgt.balanceOf(iBgtVault.address)).to.eq(amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).unstake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getReward', () => {
    it('should work normally (honey)', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await increase(ONE_DAY_SECONDS * 30);

      const reward = await core.berachainRewardsEcosystem.iBgtStakingPool.getAllRewardsForUser(iBgtVault.address);
      await iBgtVault.getReward();
      await expectWalletBalance(iBgtVault, core.tokens.iBgt, ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, reward[0].amount);
    });

    it('should work normally for iBgt reward', async () => {
      await testInfraredVault.setRewardTokens([core.tokens.iBgt.address]);
      await core.tokens.iBgt.connect(iBgtWhale).approve(testInfraredVault.address, rewardAmount);
      await testInfraredVault.connect(iBgtWhale).addReward(core.tokens.iBgt.address, rewardAmount);
      await registry.connect(core.governance).ownerSetIBgtStakingVault(testInfraredVault.address);

      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);

      await iBgtVault.getReward();
      await expectWalletBalance(iBgtVault, core.tokens.iBgt, ZERO_BI);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei.add(rewardAmount));
    });

    it('should work normally for reward that has reached max supply wei', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.wbera, 1);
      await testInfraredVault.setRewardTokens([core.tokens.wbera.address]);
      await setupWBERABalance(core, core.hhUser1, rewardAmount, { address: testInfraredVault.address });
      await testInfraredVault.connect(core.hhUser1).addReward(core.tokens.wbera.address, rewardAmount);
      await registry.connect(core.governance).ownerSetIBgtStakingVault(testInfraredVault.address);

      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await expectWalletBalance(core.hhUser1, core.tokens.wbera, ZERO_BI);
      await iBgtVault.getReward();
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wbera, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.wbera, rewardAmount);
    });

    it('should work normally for reward not listed on dolomite', async () => {
      const testToken = await createTestToken();
      await testInfraredVault.setRewardTokens([testToken.address]);
      await testToken.addBalance(core.hhUser1.address, rewardAmount);
      await testToken.connect(core.hhUser1).approve(testInfraredVault.address, rewardAmount);
      await testInfraredVault.connect(core.hhUser1).addReward(testToken.address, rewardAmount);
      await registry.connect(core.governance).ownerSetIBgtStakingVault(testInfraredVault.address);

      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await expectWalletBalance(core.hhUser1, testToken, ZERO_BI);
      await iBgtVault.getReward();
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await expectWalletBalance(core.hhUser1, testToken, rewardAmount);
    });

    it('should work normally if 0 reward', async () => {
      await testInfraredVault.setRewardTokens([core.tokens.iBgt.address]);
      await registry.connect(core.governance).ownerSetIBgtStakingVault(testInfraredVault.address);

      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);

      await iBgtVault.getReward();
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).getReward(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exit', () => {
    it('should work normally', async () => {
      await iBgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      await increase(ONE_DAY_SECONDS * 30);

      const reward = await core.berachainRewardsEcosystem.iBgtStakingPool.getAllRewardsForUser(iBgtVault.address);
      await iBgtVault.exit();
      await expectWalletBalance(iBgtVault, core.tokens.iBgt, amountWei);
      await expectProtocolBalance(core, iBgtVault, defaultAccountNumber, iBgtMarketId, amountWei);
      expect(await core.berachainRewardsEcosystem.iBgtStakingPool.balanceOf(iBgtVault.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.honey, reward[0].amount);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        iBgtVault.connect(core.hhUser2).exit(),
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

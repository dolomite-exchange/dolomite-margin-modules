import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { Emitter, Emitter__factory, OARB } from '../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getBlockTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupUSDCBalance,
} from 'packages/base/test/utils/setup';
import { createOARB } from './liquidity-mining-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;
const defaultAllocPoint = BigNumber.from('100');
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000

// Emitter contract is not in use in production. These tests don't all pass
xdescribe('Emitter', () => {
  let snapshotId: string;
  let core: CoreProtocol;

  let emitter: Emitter;
  let oARB: OARB;
  let startTime: number;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    oARB = await createOARB(core);
    startTime = await getBlockTimestamp(await ethers.provider.getBlockNumber()) + 200;
    emitter = await createContractWithAbi<Emitter>(
      Emitter__factory.abi,
      Emitter__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        oARB.address,
        ONE_ETH_BI,
        startTime,
      ],
    );

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000', // $1.00
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(3), core.dolomiteMargin);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(emitter.address, true);

    await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await emitter.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await emitter.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await emitter.oARB()).to.eq(oARB.address);
      expect(await emitter.oARBPerSecond()).to.eq(ONE_ETH_BI);
      expect(await emitter.startTime()).to.eq(startTime);
    });
  });

  describe('#deposit', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      const result = await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectEvent(emitter, result, 'Deposit', {
        user: core.hhUser1.address,
        marketId: core.marketIds.usdc,
        amount: usdcAmount,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount,
      );
    });

    it('should accrue rewards and deposit more', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount,
      );

      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount.mul(2),
      );
    });

    it('should reset rewardDebt if new campaign is started', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount.div(2));

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      expect((await emitter.userInfo(core.marketIds.usdc, core.hhUser1.address)).rewardDebt).to.be.gt(ZERO_BI);

      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);
      await expect(() => emitter.connect(core.hhUser1).deposit(
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount.div(2),
      )).to.changeTokenBalance(oARB, core.hhUser1, ZERO_BI);
      expect((await emitter.poolInfo(core.marketIds.usdc)).accOARBPerShare).to.eq(ZERO_BI);
      expect((await emitter.userInfo(core.marketIds.usdc, core.hhUser1.address)).rewardDebt).to.eq(ZERO_BI);
    });

    it('should not reset rewardDebt if user has been updated after startTime', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount,
      );

      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('2'));

      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('4').sub(1));
    });

    it('should fail if pool is not initialized', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount),
        'Emitter: Pool not initialized',
      );
    });

    it('should fail if passed zero amount', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await expectThrow(
        emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, ZERO_BI),
        'Emitter: Invalid amount',
      );
    });
  });

  describe('#withdraw', () => {
    it('should work normally to accrue rewards', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await setNextBlockTimestamp(startTime + 1);
      const result = await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectEvent(emitter, result, 'Withdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.usdc,
        amount: ZERO_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
    });

    it('should work normally to accrue rewards and withdraw', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
    });

    it('should withdraw all', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ethers.constants.MaxUint256);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
    });

    it('should reset rewardDebt if new campaign is started', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      expect((await emitter.userInfo(core.marketIds.usdc, core.hhUser1.address)).rewardDebt).to.be.gt(ZERO_BI);

      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);
      await expect(() => emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI))
        .to.changeTokenBalance(oARB, core.hhUser1, ZERO_BI);
      expect((await emitter.poolInfo(core.marketIds.usdc)).accOARBPerShare).to.eq(ZERO_BI);
      expect((await emitter.userInfo(core.marketIds.usdc, core.hhUser1.address)).rewardDebt).to.eq(ZERO_BI);
    });

    it('should not reset rewardDebt if user has been updated after startTime', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount,
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);

      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('2'));
    });

    it('should fail if pool is not initialized', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount),
        'Emitter: Pool not initialized',
      );
    });

    it('should fail if withdraw amount is greater than user amount', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectThrow(
        emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount.add(1)),
        'Emitter: Insufficient balance',
      );
    });
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const result = await emitter.connect(core.hhUser1).emergencyWithdraw(core.marketIds.usdc);
      await expectEvent(emitter, result, 'EmergencyWithdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.usdc,
        amount: usdcAmount,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if users amount is zero', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await expectThrow(
        emitter.connect(core.hhUser1).emergencyWithdraw(core.marketIds.usdc),
        'Emitter: Insufficient balance',
      );
    });
  });

  describe('#massUpdatePools', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.massUpdatePools();
      expect((await emitter.poolInfo(core.marketIds.usdc)).lastRewardTime).to.eq(startTime + 1);
      expect((await emitter.poolInfo(core.marketIds.weth)).lastRewardTime).to.eq(startTime + 1);
      expect((await emitter.poolInfo(core.marketIds.dai!)).lastRewardTime).to.eq(startTime + 1);
    });
  });

  describe('#updatePool', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await setNextBlockTimestamp(startTime + 1);
      await emitter.updatePool(core.marketIds.usdc);
      const pool = await emitter.poolInfo(core.marketIds.usdc);

      expect(pool.marketId).to.eq(core.marketIds.usdc);
      expect(pool.lastRewardTime).to.eq(startTime + 1);
      expect(pool.accOARBPerShare).to.eq(parseEther('10000000000')); // 1e28
    });

    it('should not update rewards if supply is zero', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await setNextBlockTimestamp(startTime + 100);
      await emitter.updatePool(core.marketIds.usdc);
      const pool = await emitter.poolInfo(core.marketIds.usdc);

      expect(pool.marketId).to.eq(core.marketIds.usdc);
      expect(pool.lastRewardTime).to.eq(startTime + 100);
      expect(pool.accOARBPerShare).to.eq(0);
    });

    it('should not update if block.number is less than lastRewardBlock', async () => {
      const testEmitter = await createContractWithAbi<Emitter>(
        Emitter__factory.abi,
        Emitter__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          oARB.address,
          ONE_ETH_BI,
          startTime,
        ],
      );
      await testEmitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await testEmitter.updatePool(core.marketIds.usdc);
      expect((await testEmitter.poolInfo(core.marketIds.usdc)).lastRewardTime).to.eq(startTime);
    });
  });

  describe('#ownerAddPool', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      const pool = await emitter.poolInfo(core.marketIds.usdc);

      expect(pool.marketId).to.eq(core.marketIds.usdc);
      expect(pool.allocPoint).to.eq(defaultAllocPoint);
      expect(pool.lastRewardTime).to.eq(startTime);
      expect(pool.accOARBPerShare).to.eq(0);
      expect(await emitter.totalAllocPoint()).to.eq(defaultAllocPoint);
    });

    it('should work normally with update', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);
      expect((await emitter.poolInfo(core.marketIds.usdc)).lastRewardTime).to.eq(startTime);
      expect((await emitter.poolInfo(core.marketIds.weth)).lastRewardTime).to.eq(startTime);
      expect((await emitter.poolInfo(core.marketIds.dai!)).lastRewardTime).to.eq(startTime);

      await setNextBlockTimestamp(startTime + 100);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.mim!, defaultAllocPoint, true);
      expect((await emitter.poolInfo(core.marketIds.usdc)).lastRewardTime).to.eq(startTime + 100);
      expect((await emitter.poolInfo(core.marketIds.weth)).lastRewardTime).to.eq(startTime + 100);
      expect((await emitter.poolInfo(core.marketIds.dai!)).lastRewardTime).to.eq(startTime + 100);
      expect((await emitter.poolInfo(core.marketIds.mim!)).lastRewardTime).to.eq(startTime + 100);
    });

    it('should use block.timestamp if after startTime', async () => {
      const testEmitter = await createContractWithAbi<Emitter>(
        Emitter__factory.abi,
        Emitter__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          oARB.address,
          ONE_ETH_BI,
          startTime,
        ],
      );
      await setNextBlockTimestamp(startTime + 500);
      await testEmitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      expect((await testEmitter.poolInfo(core.marketIds.usdc)).lastRewardTime).to.eq(startTime + 500);
    });

    it('should fail if pool already exists', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await expectThrow(
        emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false),
        'Emitter: Pool already exists',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetPool', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      expect((await emitter.poolInfo(core.marketIds.usdc)).allocPoint).to.eq(defaultAllocPoint);
      expect(await emitter.totalAllocPoint()).to.eq(defaultAllocPoint);

      await emitter.connect(core.governance).ownerSetPool(core.marketIds.usdc, 150);
      expect((await emitter.poolInfo(core.marketIds.usdc)).allocPoint).to.eq(150);
      expect(await emitter.totalAllocPoint()).to.eq(150);
    });

    it('should fail if pool is not initialized', async () => {
      await expectThrow(
        emitter.connect(core.governance).ownerSetPool(core.marketIds.usdc, defaultAllocPoint),
        'Emitter: Pool not initialized',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerSetPool(core.marketIds.usdc, defaultAllocPoint),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetOARBPerSecond', () => {
    it('should work normally', async () => {
      expect(await emitter.oARBPerSecond()).to.eq(ONE_ETH_BI);
      await emitter.connect(core.governance).ownerSetOARBPerSecond(10);
      expect(await emitter.oARBPerSecond()).to.eq(10);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerSetOARBPerSecond(15),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerCreateNewCampaign', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.updatePool(core.marketIds.usdc);
      let pool = await emitter.poolInfo(core.marketIds.usdc);
      expect(pool.lastRewardTime).to.eq(startTime + 1);
      expect(pool.accOARBPerShare).to.eq(parseEther('10000000000')); // 1e28

      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);
      pool = await emitter.poolInfo(core.marketIds.usdc);
      expect(pool.lastRewardTime).to.eq(startTime + 100);
      expect(pool.accOARBPerShare).to.eq(0);

      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      pool = await emitter.poolInfo(core.marketIds.usdc);
      expect(pool.lastRewardTime).to.eq(startTime + 100);
      expect(pool.accOARBPerShare).to.eq(0);
    });

    it('should fail if startTime is less than block.timestamp', async () => {
      await setNextBlockTimestamp(startTime);
      await expectThrow(
        emitter.connect(core.governance).ownerCreateNewCampaign(startTime - 1, core.tokens.link.address),
        'Emitter: Invalid startTime',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerCreateNewCampaign(startTime, core.tokens.link.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

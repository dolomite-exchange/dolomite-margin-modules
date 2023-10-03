import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { Emitter, Emitter__factory, OARB, OARB__factory } from 'src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
} from 'test/utils/setup';

const defaultAccountNumber = ZERO_BI;
const defaultAllocPoint = BigNumber.from('100');
const usdcAmount = BigNumber.from('100000000'); // $100

describe('Emitter', () => {
  let snapshotId: string;

  let core: CoreProtocol;

  let emitter: Emitter;
  let oARB: OARB;
  let blockNumber: number;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);
    blockNumber = await ethers.provider.getBlockNumber();
    emitter = await createContractWithAbi<Emitter>(
      Emitter__factory.abi,
      Emitter__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        oARB.address,
        ONE_ETH_BI,
        blockNumber,
      ]
    );

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000' // $1.00
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, oARB, true);
    await oARB.connect(core.governance).ownerInitialize();

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
    // @follow-up Do we want to test with interest or no?
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
      expect(await emitter.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await emitter.oARB()).to.eq(oARB.address);
      expect(await emitter.oARBPerBlock()).to.eq(ONE_ETH_BI);
      expect(await emitter.startBlock()).to.eq(blockNumber);
    });
  });

  describe('#add', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      const blockNumber = await ethers.provider.getBlockNumber();
      const pool = await emitter.poolInfo(core.marketIds.usdc);

      expect(pool.marketId).to.eq(core.marketIds.usdc);
      expect(pool.allocPoint).to.eq(defaultAllocPoint);
      expect(pool.lastRewardBlock).to.eq(blockNumber);
      expect(pool.accOARBPerShare).to.eq(0);
    });

    it('should use start block if after current block', async () => {
      const testEmitter = await createContractWithAbi<Emitter>(
        Emitter__factory.abi,
        Emitter__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          oARB.address,
          ONE_ETH_BI,
          blockNumber + 200,
        ]
      );
      await testEmitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      expect((await testEmitter.poolInfo(core.marketIds.usdc)).lastRewardBlock).to.eq(blockNumber + 200);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).add(core.marketIds.usdc, defaultAllocPoint),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#set', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      expect((await emitter.poolInfo(core.marketIds.usdc)).allocPoint).to.eq(defaultAllocPoint);
      expect(await emitter.totalAllocPoint()).to.eq(defaultAllocPoint);

      await emitter.connect(core.governance).set(core.marketIds.usdc, 150);
      expect((await emitter.poolInfo(core.marketIds.usdc)).allocPoint).to.eq(150);
      expect(await emitter.totalAllocPoint()).to.eq(150);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).set(core.marketIds.usdc, defaultAllocPoint),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#deposit', () => {
    // @follow-up These tests are 1 wei off because par values and interest accrual
    it('should work normally', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);

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
        usdcAmount
      );
    });

    it('should accrue rewards and deposit more', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount
      );

      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      // 2 ether because 2 blocks have passed
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, parseEther('2'));
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount.mul(2)
      );
      expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(parseEther('2'));
    });

    it('should fail if pool is not initialized', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount),
        'Emitter: Pool not initialized'
      );
    });

    it('should fail if passed zero amount', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await expectThrow(
        emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, ZERO_BI),
        'Emitter: Invalid amount'
      );
    });
  });

  describe('#withdraw', () => {
    it('should work normally to accrue rewards', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      const result = await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectEvent(emitter, result, 'Withdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.usdc,
        amount: ZERO_BI,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ONE_ETH_BI);
      expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(ONE_ETH_BI);
    });

    it('should work normally to accrue rewards and withdraw', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(ONE_ETH_BI);
    });

    it('should withdraw all', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ethers.constants.MaxUint256);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if pool is not initialized', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount),
        'Emitter: Pool not initialized'
      );
    });

    it('should fail if withdraw amount is greater than user amount', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectThrow(
        emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount.add(1)),
        'Emitter: Insufficient balance'
      );
    });
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const result = await emitter.connect(core.hhUser1).emergencyWithdraw(core.marketIds.usdc);
      await expectEvent(emitter, result, 'EmergencyWithdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.usdc,
        amount: usdcAmount,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(ZERO_BI);
    });

    it('should fail if users amount is zero', async () => {
      await emitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await expectThrow(
        emitter.connect(core.hhUser1).emergencyWithdraw(core.marketIds.usdc),
        'Emitter: Insufficient balance'
      );
    });
  });

  describe('#updatePool', () => {
    it('should not update if block.number is less than lastRewardBlock', async () => {
      const testEmitter = await createContractWithAbi<Emitter>(
        Emitter__factory.abi,
        Emitter__factory.bytecode,
        [
          core.dolomiteMargin.address,
          core.dolomiteRegistry.address,
          oARB.address,
          ONE_ETH_BI,
          blockNumber + 200,
        ]
      );
      await testEmitter.connect(core.governance).add(core.marketIds.usdc, defaultAllocPoint);
      await testEmitter.updatePool(core.marketIds.usdc);
      expect((await testEmitter.poolInfo(core.marketIds.usdc)).lastRewardBlock).to.eq(blockNumber + 200);
    });
  });
});

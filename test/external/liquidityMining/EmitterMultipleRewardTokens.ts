import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  EmitterMultipleRewardTokens,
  EmitterMultipleRewardTokens__factory,
  OARB,
  OARBStorageVault,
  OARBStorageVault__factory,
  OARB__factory,
} from 'src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getBlockTimestamp, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from 'test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupUSDCBalance,
  setupWETHBalance,
} from 'test/utils/setup';

const defaultAccountNumber = ZERO_BI;
const defaultAllocPoint = BigNumber.from('100');
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000
const wethAmount = BigNumber.from('1003933040428380918'); // Makes par value 1 ether
const wethParAmount = BigNumber.from('1000000000000000000');

describe('EmitterMultipleRewardTokens', () => {
  let snapshotId: string;
  let core: CoreProtocol;

  let emitter: EmitterMultipleRewardTokens;
  let oARB: OARB;
  let oARB2: OARB;
  let oARBStorageVault: OARBStorageVault;
  let oARBStorageVault2: OARBStorageVault;
  let startTime: number;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    oARB = await createContractWithAbi<OARB>(
      OARB__factory.abi,
      OARB__factory.bytecode,
      [core.dolomiteMargin.address]
    );
    oARB2 = await createContractWithAbi<OARB>(
      OARB__factory.abi,
      OARB__factory.bytecode,
      [core.dolomiteMargin.address]
    );
    oARBStorageVault = await createContractWithAbi<OARBStorageVault>(
      OARBStorageVault__factory.abi,
      OARBStorageVault__factory.bytecode,
      [core.dolomiteMargin.address, oARB.address]
    );
    oARBStorageVault2 = await createContractWithAbi<OARBStorageVault>(
      OARBStorageVault__factory.abi,
      OARBStorageVault__factory.bytecode,
      [core.dolomiteMargin.address, oARB2.address]
    );
    startTime = (await getBlockTimestamp(await ethers.provider.getBlockNumber())) + 200;
    emitter = await createContractWithAbi<EmitterMultipleRewardTokens>(
      EmitterMultipleRewardTokens__factory.abi,
      EmitterMultipleRewardTokens__factory.bytecode,
      [core.dolomiteMargin.address, core.dolomiteRegistry.address, ONE_ETH_BI, startTime]
    );

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000' // $1.00
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(3), core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(3), core.dolomiteMargin);
    // @follow-up Do we want to test with interest or no?
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount.mul(3));
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(emitter.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(oARBStorageVault.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(oARBStorageVault2.address, true);

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
      expect(await emitter.rewardTokenPerSecond()).to.eq(ONE_ETH_BI);
      expect(await emitter.startTime()).to.eq(startTime);
    });
  });

  describe('#deposit', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.weth,
        wethAmount
      );

      const pool = await emitter.poolInfo(core.marketIds.weth);
      expect(pool.totalPar).to.eq(wethParAmount);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(0);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(0);
    });

    it('should accrue rewards and deposit more', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      const pool = await emitter.poolInfo(core.marketIds.weth);
      expect(pool.totalPar).to.eq(wethParAmount.mul(2));
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.weth,
        wethAmount.mul(2)
      );
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(
        ONE_ETH_BI.mul(2)
      );
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
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
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await setNextBlockTimestamp(startTime + 1);
      const result = await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectEvent(emitter, result, 'Withdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.weth,
        amount: ZERO_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
    });

    it('should work normally to accrue rewards and withdraw', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, wethAmount);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount.mul(3)
      );
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(0);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
    });

    it('should withdraw all', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ethers.constants.MaxUint256);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount.mul(3)
      );
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(0);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
    });

    it('should withdraw 0 when amount is zero', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount.mul(3)
      );
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(0);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ZERO_BI);
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
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 1);
      const result = await emitter.connect(core.hhUser1).emergencyWithdraw(core.marketIds.weth);
      await expectEvent(emitter, result, 'EmergencyWithdraw', {
        user: core.hhUser1.address,
        marketId: core.marketIds.weth,
        amount: wethAmount,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount.mul(3)
      );
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(0);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(0);
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
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await setNextBlockTimestamp(startTime + 1);
      await emitter.massUpdatePools();
      expect(await emitter.poolLastRewardTime(core.marketIds.usdc, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolLastRewardTime(core.marketIds.dai!, oARB.address)).to.eq(startTime + 1);
    });
  });

  describe('#updatePool', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await setNextBlockTimestamp(startTime + 1);

      await emitter.updatePool(core.marketIds.weth);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
    });

    it('should work normally for multiple reward tokens', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddRewardToken(oARB2.address, oARBStorageVault2.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await setNextBlockTimestamp(startTime + 1);

      await emitter.updatePool(core.marketIds.weth);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB2.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB2.address)).to.eq(ONE_ETH_BI);
    });

    it('should not update rewards if supply is zero', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await setNextBlockTimestamp(startTime + 100);
      await emitter.updatePool(core.marketIds.weth);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 100);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ZERO_BI);
    });

    it('should not update if block.number is less than lastRewardBlock', async () => {
      const testEmitter = await createContractWithAbi<EmitterMultipleRewardTokens>(
        EmitterMultipleRewardTokens__factory.abi,
        EmitterMultipleRewardTokens__factory.bytecode,
        [core.dolomiteMargin.address, core.dolomiteRegistry.address, ONE_ETH_BI, startTime]
      );
      await testEmitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await testEmitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await testEmitter.updatePool(core.marketIds.weth);
      expect(await testEmitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
    });
  });

  describe('#ownerAddPool', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      const pool = await emitter.poolInfo(core.marketIds.weth);

      expect(pool.marketId).to.eq(core.marketIds.weth);
      expect(pool.allocPoint).to.eq(defaultAllocPoint);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ZERO_BI);
      expect(await emitter.totalAllocPoint()).to.eq(defaultAllocPoint);
    });

    it('should work normally for multiple reward tokens', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddRewardToken(oARB2.address, oARBStorageVault2.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      const pool = await emitter.poolInfo(core.marketIds.weth);

      expect(pool.marketId).to.eq(core.marketIds.weth);
      expect(pool.allocPoint).to.eq(defaultAllocPoint);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ZERO_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB2.address)).to.eq(startTime);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB2.address)).to.eq(ZERO_BI);
      expect(await emitter.totalAllocPoint()).to.eq(defaultAllocPoint);
    });

    it('should work normally with update', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);
      expect(await emitter.poolLastRewardTime(core.marketIds.usdc, oARB.address)).to.eq(startTime);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime);
      expect(await emitter.poolLastRewardTime(core.marketIds.dai!, oARB.address)).to.eq(startTime);

      await setNextBlockTimestamp(startTime + 100);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.mim!, defaultAllocPoint, true);
      expect(await emitter.poolLastRewardTime(core.marketIds.usdc, oARB.address)).to.eq(startTime + 100);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 100);
      expect(await emitter.poolLastRewardTime(core.marketIds.dai!, oARB.address)).to.eq(startTime + 100);
      expect(await emitter.poolLastRewardTime(core.marketIds.mim!, oARB.address)).to.eq(startTime + 100);
    });

    it('should use block.timestamp if after startTime', async () => {
      const testEmitter = await createContractWithAbi<EmitterMultipleRewardTokens>(
        EmitterMultipleRewardTokens__factory.abi,
        EmitterMultipleRewardTokens__factory.bytecode,
        [core.dolomiteMargin.address, core.dolomiteRegistry.address, ONE_ETH_BI, startTime]
      );
      await testEmitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await setNextBlockTimestamp(startTime + 500);
      await testEmitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      expect(await testEmitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 500);
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

  describe('#ownerSetRewardTokenPerSecond', () => {
    it('should work normally', async () => {
      expect(await emitter.rewardTokenPerSecond()).to.eq(ONE_ETH_BI);
      await emitter.connect(core.governance).ownerSetRewardTokenPerSecond(10);
      expect(await emitter.rewardTokenPerSecond()).to.eq(10);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerSetRewardTokenPerSecond(15),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerEnableRewardToken', () => {
    it('should fail if reward token does not exist', async () => {
      await expectThrow(
        emitter.connect(core.governance).ownerEnableRewardToken(oARB.address),
        'Emitter: Reward token does not exist',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerEnableRewardToken(oARB.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerDisableRewardToken', () => {
    it('should fail if reward token does not exist', async () => {
      await expectThrow(
        emitter.connect(core.governance).ownerDisableRewardToken(oARB.address),
        'Emitter: Reward token does not exist',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerDisableRewardToken(oARB.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddRewardToken', () => {
    it('should fail if reward token already exists', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await expectThrow(
        emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true),
        'Emitter: Reward token already exists',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveRewardToken', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.weth,
        wethAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerRemoveRewardToken(oARB.address);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);
    });

    it('should work correctly if reward token is added back', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.weth,
        wethAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerRemoveRewardToken(oARB.address);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(ONE_ETH_BI);
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 1);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('2'));
      expect(await emitter.userRewardDebt(core.marketIds.weth, core.hhUser1.address, oARB.address)).to.eq(
        parseEther('2')
      );
      expect(await emitter.poolLastRewardTime(core.marketIds.weth, oARB.address)).to.eq(startTime + 11);
      expect(await emitter.poolAccRewardTokenPerShares(core.marketIds.weth, oARB.address)).to.eq(parseEther('2'));
    });

    it('should fail if reward token does not exist', async () => {
      await expectThrow(
        emitter.connect(core.governance).ownerRemoveRewardToken(oARB.address),
        'Emitter: Reward token does not exist',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        emitter.connect(core.hhUser1).ownerRemoveRewardToken(oARB.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('Reward Calculations', () => {
    it('should work normally', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerDisableRewardToken(oARB.address);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));
    });

    it('should work correctly to disable and reenable reward token', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerDisableRewardToken(oARB.address);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));

      await setNextBlockTimestamp(startTime + 15);
      await emitter.connect(core.governance).ownerEnableRewardToken(oARB.address);

      await setNextBlockTimestamp(startTime + 20);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('10'));
    });

    it('should work correctly with two pools from the start', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddRewardToken(oARB2.address, oARBStorageVault2.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectWalletBalance(core.hhUser1.address, oARB2, ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerDisableRewardToken(oARB.address);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));
      await expectWalletBalance(core.hhUser1.address, oARB2, parseEther('10'));
    });

    it('should work correctly with second pool added later', async () => {
      await emitter.connect(core.governance).ownerAddRewardToken(oARB.address, oARBStorageVault.address, true);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.usdc, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(
        core,
        emitter.address,
        BigNumber.from(core.hhUser1.address),
        core.marketIds.usdc,
        usdcAmount
      );

      await setNextBlockTimestamp(startTime + 1);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);

      await setNextBlockTimestamp(startTime + 5);
      await emitter.connect(core.governance).ownerDisableRewardToken(oARB.address);
      await emitter.connect(core.governance).ownerAddRewardToken(oARB2.address, oARBStorageVault2.address, true);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));
      await expectWalletBalance(core.hhUser1.address, oARB2, parseEther('4'));

      await setNextBlockTimestamp(startTime + 15);
      await emitter.connect(core.governance).ownerDisableRewardToken(oARB2.address);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));
      await expectWalletBalance(core.hhUser1.address, oARB2, parseEther('9'));

      await setNextBlockTimestamp(startTime + 30);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('5'));
      await expectWalletBalance(core.hhUser1.address, oARB2, parseEther('9'));
    });
  });
});

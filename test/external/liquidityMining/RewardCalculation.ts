import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { Emitter, Emitter__factory, OARB } from 'src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getBlockTimestamp, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectProtocolBalance, expectWalletBalance } from 'test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupDAIBalance,
  setupWETHBalance,
} from 'test/utils/setup';
import { createOARB } from '../../utils/ecosystem-token-utils/liquidity-mining';

const defaultAccountNumber = ZERO_BI;
const defaultAllocPoint = BigNumber.from('100');
const wethAmount = BigNumber.from('1003933040428380918'); // Makes par value 1 ether
const daiAmount = BigNumber.from('1010674517719246597'); // Makes par value 1 ether

describe('Reward Calculation', () => {
  let snapshotId: string;
  let core: CoreProtocol;

  let emitter: Emitter;
  let oARB: OARB;
  let startTime: number;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.dai!);

    oARB = await createOARB(core);
    startTime = (await getBlockTimestamp(await ethers.provider.getBlockNumber())) + 200;
    emitter = await createContractWithAbi<Emitter>(Emitter__factory.abi, Emitter__factory.bytecode, [
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address,
      oARB.address,
      ONE_ETH_BI,
      startTime,
    ]);

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000', // $1.00
    );

    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(3), core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser2, wethAmount.mul(3), core.dolomiteMargin);
    await setupDAIBalance(core, core.hhUser2, daiAmount.mul(3), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount.mul(3));
    await depositIntoDolomiteMargin(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, wethAmount.mul(3));
    await depositIntoDolomiteMargin(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai!, daiAmount.mul(3));
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(emitter.address, true);

    await expectProtocolBalance(
      core,
      core.hhUser1.address,
      defaultAccountNumber,
      core.marketIds.weth,
      wethAmount.mul(3),
    );
    await expectProtocolBalance(
      core,
      core.hhUser2.address,
      defaultAccountNumber,
      core.marketIds.weth,
      wethAmount.mul(3),
    );
    await expectProtocolBalance(
      core,
      core.hhUser2.address,
      defaultAccountNumber,
      core.marketIds.dai!,
      daiAmount.mul(3),
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Reward calculations with 2 users and 1 pool', () => {
    it('should calculate evenly when both deposit before startTime', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.5'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.5'));
    });

    it('should calculate correctly with one user doubling the deposit of the other', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount.mul(2));
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      // console.log((await emitter.userInfo(core.marketIds.weth, core.hhUser1.address)).amount);
      // console.log((await emitter.userInfo(core.marketIds.weth, core.hhUser2.address)).amount);

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      // @follow up are we losing 1 wei somewhere
      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.666666666666666666'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.333333333333333333'));
    });

    it('should calculate correctly with one user tripling the deposit of the other', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount.mul(3));
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.75'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.25'));
    });

  });

  describe('Reward calculations with 2 users, 1 pool and new campaign', () => {
    it('should erase pending rewards and accrue new rewards correctly with even amount', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);

      await setNextBlockTimestamp(startTime + 101);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.5'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.5'));
    });

    it('should erase pending rewards and accrue new rewards correctly with doubled amount', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount.mul(2));
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);

      await setNextBlockTimestamp(startTime + 101);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.666666666666666666'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.333333333333333333'));
    });

    it('should erase pending rewards and accrue new rewards correctly with tripled amount', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount.mul(3));
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);

      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);

      await setNextBlockTimestamp(startTime + 101);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.weth, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.75'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.25'));
    });
  });

  describe('Reward calculations with 2 users and 2 pools with equal allocs', () => {
    it('should calculate evenly when both deposit before startTime', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.dai!, daiAmount);

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.dai!, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.5'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.5'));
    });

    it('should calculate evenly when both deposit before startTime regardless of amounts', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.dai!, daiAmount.mul(2));

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.dai!, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.5'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.5'));
    });
  });

  describe('Reward calculations with 2 users and 2 pools with unequal allocs', () => {
    it('should calculate correctly when both deposit before startTime and alloc is triple for one pool', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint.mul(3), false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.dai!, daiAmount.mul(2));

      await setNextBlockTimestamp(startTime + 1);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.dai!, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.75'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.25'));
    });
  });

  describe('Reward calculations with 2 users, 2 pools and new campaign', () => {
    it('should erase pending rewards and accrue new rewards correctly', async () => {
      await ethers.provider.send('evm_setAutomine', [true]);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.weth, defaultAllocPoint, false);
      await emitter.connect(core.governance).ownerAddPool(core.marketIds.dai!, defaultAllocPoint, false);

      await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.weth, wethAmount);
      await emitter.connect(core.hhUser2).deposit(defaultAccountNumber, core.marketIds.dai!, daiAmount);

      await emitter.massUpdatePools();
      await setNextBlockTimestamp(startTime + 10);
      await emitter.connect(core.governance).ownerCreateNewCampaign(startTime + 100, oARB.address);

      await setNextBlockTimestamp(startTime + 101);
      await ethers.provider.send('evm_setAutomine', [false]);
      await emitter.connect(core.hhUser1).withdraw(core.marketIds.weth, 0);
      await emitter.connect(core.hhUser2).withdraw(core.marketIds.dai!, 0);
      await mine();

      await expectWalletBalance(core.hhUser1.address, oARB, parseEther('.5'));
      await expectWalletBalance(core.hhUser2.address, oARB, parseEther('.5'));
    });
  });
});

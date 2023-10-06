import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { Emitter, EmitterMultipleRewardTokens, EmitterMultipleRewardTokens__factory, Emitter__factory, OARB, OARBStorageVault, OARBStorageVault__factory, OARB__factory } from 'src/types';
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
} from 'test/utils/setup';

const defaultAccountNumber = ZERO_BI;
const defaultAllocPoint = BigNumber.from('100');
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000

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

    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);
    oARB2 = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);
    oARBStorageVault = await createContractWithAbi<OARBStorageVault>(
        OARBStorageVault__factory.abi,
        OARBStorageVault__factory.bytecode,
        [oARB.address],
    );
    oARBStorageVault2 = await createContractWithAbi<OARBStorageVault>(
        OARBStorageVault__factory.abi,
        OARBStorageVault__factory.bytecode,
        [oARB2.address],
    );
    startTime = await getBlockTimestamp(await ethers.provider.getBlockNumber()) + 200;
    emitter = await createContractWithAbi<EmitterMultipleRewardTokens>(
      EmitterMultipleRewardTokens__factory.abi,
      EmitterMultipleRewardTokens__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        ONE_ETH_BI,
        startTime,
      ]
    );

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000' // $1.00
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(3), core.dolomiteMargin);
    // @follow-up Do we want to test with interest or no?
    await disableInterestAccrual(core, core.marketIds.usdc);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
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
      expect(await emitter.oARBPerSecond()).to.eq(ONE_ETH_BI);
      expect(await emitter.startTime()).to.eq(startTime);
    });
  });

  describe('#deposit', () => {
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

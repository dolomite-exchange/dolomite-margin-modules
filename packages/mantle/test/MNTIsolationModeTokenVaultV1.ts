import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  advanceByTimeDelta,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEthBalance,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolMantle } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-mantle';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  IWETH,
  MNTIsolationModeVaultFactory,
  MNTRegistry,
  TestMNTIsolationModeTokenVaultV1,
  TestMNTIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createMNTIsolationModeVaultFactory,
  createMNTRegistry,
  createMNTUnwrapperTraderV2,
  createMNTWrapperTraderV2,
  createTestMNTIsolationModeTokenVaultV1,
  setupWmntToken,
} from './mnt-ecosystem-utils';
import { DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS } from './mnt-utils';

const amountWei = parseEther('1');
const defaultAccountNumber = 0;

describe('MNTIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let isolationModeMarketId: BigNumber;
  let mntVault: TestMNTIsolationModeTokenVaultV1;
  let underlyingToken: IWETH;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_MNT_TESTS,
      network: Network.Mantle,
    });

    mntRegistry = await createMNTRegistry(core);

    underlyingToken = await setupWmntToken(core);

    const vaultImplementation = await createTestMNTIsolationModeTokenVaultV1();
    mntFactory = await createMNTIsolationModeVaultFactory(mntRegistry, vaultImplementation, underlyingToken, core);

    unwrapper = await createMNTUnwrapperTraderV2(mntFactory, core);
    wrapper = await createMNTWrapperTraderV2(mntFactory, core);

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: mntFactory.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(underlyingToken.address),
    });
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(
        mntFactory.address,
        await core.chroniclePriceOracleV3.getScribeByToken(underlyingToken.address),
        false,
      );

    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    isolationModeMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(mntFactory.address);

    await mntFactory.createVault(core.hhUser1.address);
    mntVault = setupUserVaultProxy<TestMNTIsolationModeTokenVaultV1>(
      await mntFactory.getVaultByAccount(core.hhUser1.address),
      TestMNTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    expect(await mntVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#receive', () => {
    it('should succeed if funds are blind transferred in', async () => {
      await core.hhUser1.sendTransaction({
        to: mntVault.address,
        value: amountWei,
      });
      await expectEthBalance(mntVault, amountWei);
    });
  });

  describe('#depositPayableIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });
      expect(await mntVault.isCurrencyTransfer()).to.be.false;

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);

      await expectTotalSupply(mntFactory, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber);
      await expectThrow(mntVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        mntVault.depositPayableIntoVaultForDolomiteMargin('1'),
        'IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
      const factoryImpersonator = await impersonate(mntFactory.address, true);
      await expectThrow(
        mntVault.connect(factoryImpersonator).depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner can call <${factoryImpersonator.addressLower}>`,
      );
    });
  });

  describe('#withdrawPayableFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });
      expect(await mntVault.isCurrencyTransfer()).to.be.false;

      await advanceByTimeDelta(61);
      expect(() =>
        mntVault.withdrawPayableFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
      ).to.changeEtherBalance(core.hhUser1, amountWei);
      expect(await mntVault.isCurrencyTransfer()).to.be.false;

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, ZERO_BI);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);

      await expectTotalSupply(mntFactory, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.withdrawPayableFromVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(mntVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        mntVault.withdrawPayableFromVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).withdrawPayableFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#stake', () => {
    it('should work normally', async () => {
      const result = await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, {
        value: amountWei,
      });

      result.timestamp = await time.latest();
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
      await advanceByTimeDelta(61);
      const unstakeAmount = parseEther('0.25');
      await mntVault.unstake(unstakeAmount);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, unstakeAmount);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);

      await expectTotalSupply(mntFactory, amountWei);

      const stakeAmount = parseEther('0.1');
      await mntVault.stake(stakeAmount);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, unstakeAmount.sub(stakeAmount));
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);

      await expectTotalSupply(mntFactory, amountWei);
    });

    it('should not stake if amount is too small', async () => {
      const result = await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, {
        value: amountWei,
      });

      result.timestamp = await time.latest();
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);

      await advanceByTimeDelta(61);
      await mntVault.unstake(amountWei);
      await mntVault.stake(ONE_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, amountWei);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectTotalSupply(mntFactory, amountWei);
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
    });

    it('should not stake if cooling down', async () => {
      const result = await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, {
        value: amountWei,
      });

      result.timestamp = await time.latest();
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectTotalSupply(mntFactory, amountWei);

      await mntVault.stake(amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectTotalSupply(mntFactory, amountWei);
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
    });

    it('should not stake if cooling down from extra time', async () => {
      const result = await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, {
        value: amountWei,
      });

      result.timestamp = await time.latest();
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectTotalSupply(mntFactory, amountWei);

      await advanceByTimeDelta(15);

      await mntVault.stake(amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);
      await expectTotalSupply(mntFactory, amountWei);
      expect(await mntVault.lastStakeTimestamp()).to.eq(result.timestamp);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.stake(amountWei);
      await expectThrow(mntVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not sent by vault owner', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).stake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#unstake', () => {
    it('should work normally', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });
      expect(await mntVault.isCurrencyTransfer()).to.be.false;

      await advanceByTimeDelta(61);

      const unstakeAmount = parseEther('0.25');
      await mntVault.unstake(unstakeAmount);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, mntVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, mntFactory, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, unstakeAmount);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);

      await expectTotalSupply(mntFactory, amountWei);
    });

    it('should fail if stake is cooling down', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });
      expect(await mntVault.isCurrencyTransfer()).to.be.false;

      await expectThrow(mntVault.unstake(amountWei), 'MNTIsolationModeTokenVaultV1: Stake is cooling down');
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await mntVault.populateTransaction.unstake(amountWei);
      await expectThrow(mntVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not sent by vault owner', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).unstake(amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work when doing a WMNT transfer', async () => {
      await underlyingToken.connect(core.hhUser1).deposit({ value: amountWei });
      await underlyingToken.approve(mntVault.address, amountWei);
      await mntVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    });

    it('should fail when caller is not the vault factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work when doing a WMNT transfer and no unstaking', async () => {
      await mntVault.depositPayableIntoVaultForDolomiteMargin(defaultAccountNumber, { value: amountWei });
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);

      await advanceByTimeDelta(10);
      await mntVault.unstake(amountWei);
      await expectWalletBalance(mntVault, underlyingToken, amountWei);

      await mntVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectWalletBalance(mntVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail when caller is not the vault factory', async () => {
      await expectThrow(
        mntVault.connect(core.hhUser2).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work', async () => {
      expect(await mntVault.isExternalRedemptionPaused()).to.equal(false);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await mntVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await mntVault.registry()).to.equal(mntRegistry.address);
    });
  });
});

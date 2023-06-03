import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausable__factory,
  TestIsolationModeUnwrapperTrader,
  TestIsolationModeUnwrapperTrader__factory,
} from '../../../../src/types';
import {
  createContractWithAbi,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectProtocolBalance, expectThrow } from '../../../utils/assertions';
import { createTestIsolationModeFactory } from '../../../utils/ecosystem-token-utils/testers';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../../utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

describe('IsolationModeTokenVaultV1WithPausable', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTrader;
  let factory: TestIsolationModeFactory;
  let userVaultImplementation: BaseContract;
  let userVault: TestIsolationModeTokenVaultV1WithPausable;

  let solidUser: SignerWithAddress;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestIsolationModeTokenVaultV1WithPausable__factory.abi,
      TestIsolationModeTokenVaultV1WithPausable__factory.bytecode,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);
    await core.testPriceOracle!.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTrader__factory.abi,
      TestIsolationModeUnwrapperTrader__factory.bytecode,
      [core.usdc.address, factory.address, core.dolomiteMargin.address],
    );
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithPausable>(
      vaultAddress,
      TestIsolationModeTokenVaultV1WithPausable__factory,
      core.hhUser1,
    );
    await userVault.initialize();

    otherToken = await createTestToken();
    await core.testPriceOracle!.setPrice(
      otherToken.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

    await otherToken.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);

    await otherToken.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId, bigOtherAmountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#openBorrowPosition', () => {
    it('should work normally when not paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when paused', async () => {
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Invalid toAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally when not paused', async () => {
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, ZERO_BI);
    });

    it('should fail when paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId],
        ),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
      );
    });

    it('should fail when underlying is requested to be withdrawn', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [underlyingMarketId],
        ),
        `IsolationModeTokenVaultV1: Cannot withdraw market to wallet <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId],
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work when not paused', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.isExternalRedemptionPaused()).to.be.false;
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when paused', async () => {
      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'IsolationModeVaultV1Pausable: Cannot execute when paused',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when borrowAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work when redemptions are paused and debt is repaid', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should work when no allowable debt market is set (all are allowed then)', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.mul(-1));
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei.mul(2));
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([otherMarketId]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.mul(-1).div(2));
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei.mul(3).div(2),
      );
    });

    it('should work when 1 allowable collateral market is set', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.mul(-1));
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei.mul(2));
    });

    it('should work when 1 allowable debt market is set & market is paused', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.None,
      );

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.div(2));
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei.div(2),
      );
    });

    it('should fail when redemptions are paused and debt is increased', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);

      await userVault.setIsExternalRedemptionPaused(true);
      expect(await userVault.isExternalRedemptionPaused()).to.be.true;

      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.To,
        ),
        `IsolationModeVaultV1Pausable: Borrow cannot go up when paused <${otherMarketId.toString()}>`,
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when not underlying market is used', async () => {
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          underlyingMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeTokenVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when an invalid debt market is used', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.To,
        ),
        `IsolationModeTokenVaultV1: Market not allowed as debt <${otherMarketId}>`,
      );
    });
  });
});

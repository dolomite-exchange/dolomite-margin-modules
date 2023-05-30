import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultUnwrapper,
  TestWrappedTokenUserVaultUnwrapper__factory,
  TestWrappedTokenUserVaultV1WithPausable__factory,
  TestWrappedTokenUserVaultV1WithPausable,
} from '../../../../src/types';
import {
  createContractWithAbi,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectProtocolBalance, expectThrow } from '../../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../../utils/setup';
import { createTestWrappedTokenFactory } from '../../../utils/wrapped-token-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

describe('WrappedTokenUserVaultV1WithPausable', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestWrappedTokenUserVaultUnwrapper;
  let factory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let userVault: TestWrappedTokenUserVaultV1WithPausable;

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
      TestWrappedTokenUserVaultV1WithPausable__factory.abi,
      TestWrappedTokenUserVaultV1WithPausable__factory.bytecode,
      [],
    );
    factory = await createTestWrappedTokenFactory(core, underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    tokenUnwrapper = await createContractWithAbi(
      TestWrappedTokenUserVaultUnwrapper__factory.abi,
      TestWrappedTokenUserVaultUnwrapper__factory.bytecode,
      [core.usdc.address, factory.address, core.dolomiteMargin.address],
    );
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestWrappedTokenUserVaultV1WithPausable>(
      vaultAddress,
      TestWrappedTokenUserVaultV1WithPausable__factory,
      core.hhUser1,
    );
    await userVault.initialize();

    otherToken = await createTestToken();
    await core.testPriceOracle.setPrice(
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
      await userVault.setIsExternalRedemptionPaused(true);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
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
        `WrappedTokenUserVaultV1Pausable: Borrow cannot go up when paused <${otherMarketId.toString()}>`,
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
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
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
        `WrappedTokenUserVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`,
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
        `WrappedTokenUserVaultV1: Market not allowed as debt <${otherMarketId}>`,
      );
    });
  });
});

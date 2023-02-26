import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestWrappedTokenUserVaultFactory, TestWrappedTokenUserVaultUnwrapper, TestWrappedTokenUserVaultUnwrapper__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultV1,
} from '../../../src/types';
import { WETH_MARKET_ID } from '../../../src/utils/constants';
import { createContractWithAbi, createTestToken, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createTestWrappedTokenFactory } from '../../utils/wrapped-token-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

describe('WrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestWrappedTokenUserVaultUnwrapper;
  let factory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let userVault: TestWrappedTokenUserVaultV1;

  let solidUser: SignerWithAddress;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
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
      [core.usdc.address, factory.address, core.dolomiteMargin.address]
    );
    await factory.connect(core.governance).initialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
      vaultAddress,
      TestWrappedTokenUserVaultV1__factory,
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
    await depositIntoDolomiteMargin(core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);

    await otherToken.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(solidUser, defaultAccountNumber, otherMarketId, bigOtherAmountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('basic read functions', () => {
    it('should work', async () => {
      expect(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
      expect(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(factory.address);
      expect(await userVault.marketId()).to.eq(underlyingMarketId);
    });
  });

  describe('#nonReentrant', () => {
    it('should work when no reentrancy happens', async () => {
      await userVault.testReentrancy(false);
    });

    it('should not work when reentrancy happens', async () => {
      await expectThrow(
        userVault.testReentrancy(true),
        'WrappedTokenUserVaultV1: Reentrant call',
      );
    });
  });

  describe('#initialize', () => {
    it('should fail when already initialized', async () => {
      await expectThrow(
        userVault.initialize(),
        'WrappedTokenUserVaultV1: Already initialized',
      );
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work when interacted with via factory', async () => {
      const factorySigner = await impersonate(factory.address, true);
      await userVault.connect(factorySigner).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin('1', amountWei),
        'WrappedTokenUserVaultV1: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin('1', amountWei),
        'WrappedTokenUserVaultV1: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, borrowAccountNumber),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally', async () => {
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

    it('should not work when underlying is requested to be withdrawn', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [underlyingMarketId],
        ),
        `WrappedTokenUserVaultV1: Cannot withdraw market to wallet <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId],
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when borrowAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should work normally when collateral market is allowed', async () => {
      await factory.setAllowableCollateralMarketIds([otherMarketId]);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should work normally for disallowed collateral asset that goes negative (debt market)', async () => {
      await factory.setAllowableCollateralMarketIds([WETH_MARKET_ID]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );

      // the default account had $10, then added another $10, then lost $5, so it should have $15
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, BigNumber.from('15000000'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei.div(-2));
    });

    it('should work when non-allowable debt market is transferred in', async () => {
      await factory.setAllowableDebtMarketIds([WETH_MARKET_ID]);
      // attempt to transfer another market ID in
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when underlying token is used as transfer token', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          underlyingMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });

    it('should fail when transferring in an unsupported collateral token', async () => {
      await factory.setAllowableCollateralMarketIds([WETH_MARKET_ID]);
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Market not allowed as collateral <${otherMarketId.toString()}>`,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
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
    });

    it('should work when 1 allowable collateral market is set', async () => {
      await factory.setAllowableCollateralMarketIds([WETH_MARKET_ID]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([WETH_MARKET_ID]);
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
      await factory.setAllowableDebtMarketIds([WETH_MARKET_ID]);
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

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
      await userVault.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId, ZERO_BI);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when underlying market is repaid', async () => {
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          underlyingMarketId,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Invalid marketId <${underlyingMarketId.toString()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

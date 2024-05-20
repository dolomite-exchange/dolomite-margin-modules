import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestDoAnything,
  TestDoAnything__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { getSimpleZapParams } from '../../utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000

describe('IsolationModeTokenVaultV1WithPausableAndOnlyEoa', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let factory: TestIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;
  let eoaVault: TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;
  let contractVault: TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;
  let doAnything: TestDoAnything;

  let solidUser: SignerWithAddressWithSafety;
  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherToken2: CustomTestToken;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa>(
      'TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa',
      libraries,
      [],
    );
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    doAnything = await createContractWithAbi<TestDoAnything>(
      TestDoAnything__factory.abi,
      TestDoAnything__factory.bytecode,
      [],
    );

    await factory.createVault(core.hhUser1.address);
    await factory.createVault(doAnything.address);

    const eoaVaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    eoaVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa>(
      eoaVaultAddress,
      TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory,
      core.hhUser1,
    );

    const doAnythingVaultAddress = await factory.getVaultByAccount(doAnything.address);
    contractVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa>(
      doAnythingVaultAddress,
      TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory,
    );

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(eoaVaultAddress, amountWei);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

    await otherToken1.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken1.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId1, bigOtherAmountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);

    await otherToken2.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken2.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId2, bigOtherAmountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should work normally when an EOA calls factory for creation', async () => {
      const eoaVaultAddress = await factory.calculateVaultByAccount(core.hhUser4.address);
      await underlyingToken.connect(core.hhUser4).addBalance(core.hhUser4.address, amountWei);
      await underlyingToken.connect(core.hhUser4).approve(eoaVaultAddress, amountWei);
      await factory.connect(core.hhUser4).createVaultAndDepositIntoDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser4, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVaultAddress, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVaultAddress, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when a contract calls factory for creation', async () => {
      const doAnything = await createContractWithAbi<TestDoAnything>(
        TestDoAnything__factory.abi,
        TestDoAnything__factory.bytecode,
        [],
      );
      const transaction = await factory.populateTransaction.createVaultAndDepositIntoDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.connect(core.hhUser4).callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Vault owner is not an EOA <${doAnything.address.toLowerCase()}>`,
      );
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Vault owner is not an EOA <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei.div(2));

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei.div(2));
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei.div(2));
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.withdrawFromVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);

      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.closeBorrowPositionWithUnderlyingVaultToken(
        borrowAccountNumber,
        defaultAccountNumber,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await eoaVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [otherMarketId1],
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferFromPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work normally when called by an EOA owner', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);

      await eoaVault.setIsExternalRedemptionPaused(true);

      await eoaVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
      await eoaVault.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.To,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should work normally', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await eoaVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work when called by a trusted converter', async () => {
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(doAnything.address, true);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await eoaVault.populateTransaction.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await doAnything.callAnything(transaction.to!, transaction.data!);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should fail when not called by a trusted converter nor an EOA', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await contractVault.populateTransaction.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA or converter can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should work normally', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await eoaVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should work normally when called a trusted converter', async () => {
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(doAnything.address, true);

      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await eoaVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await eoaVault.populateTransaction.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await doAnything.callAnything(transaction.to!, transaction.data!);

      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should fail when not called by a trusted converter nor an EOA', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await contractVault.populateTransaction.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA or converter can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await eoaVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should work normally when called by a trusted converter', async () => {
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(doAnything.address, true);

      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await eoaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await eoaVault.populateTransaction.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await doAnything.callAnything(transaction.to!, transaction.data!);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId1,
        ZERO_BI,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        eoaVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should fail when not called by a trusted converter nor an EOA', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const transaction = await contractVault.populateTransaction.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA or converter can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });
});

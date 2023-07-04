import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestDoAnything,
  TestDoAnything__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory,
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
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '../../../utils/assertions';
import { createTestIsolationModeFactory } from '../../../utils/ecosystem-token-utils/testers';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../../utils/setup';

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
  let eoaVault: TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;
  let contractVault: TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;
  let doAnything: TestDoAnything;

  let solidUser: SignerWithAddress;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory.abi,
      TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa__factory.bytecode,
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
      [core.tokens.usdc.address, factory.address, core.dolomiteMargin.address],
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

    await eoaVault.initialize();
    await contractVault.connect(core.hhUser1).initialize();

    otherToken = await createTestToken();
    await core.testPriceOracle!.setPrice(
      otherToken.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(eoaVaultAddress, amountWei);

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

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally when called by an EOA owner', async () => {
      await eoaVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should work normally an EOA calls factory for creation', async () => {
      const eoaVaultAddress = await factory.calculateVaultByAccount(core.hhUser4.address);
      await underlyingToken.connect(core.hhUser4).addBalance(core.hhUser4.address, amountWei);
      await underlyingToken.connect(core.hhUser4).approve(eoaVaultAddress, amountWei);
      await factory.connect(core.hhUser4).createVaultAndDepositIntoDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser4, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser4, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVaultAddress, defaultAccountNumber, underlyingMarketId, amountWei);
      await expectProtocolBalance(core, eoaVaultAddress, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail contract calls factory for creation', async () => {
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
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await eoaVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId, ZERO_BI);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [otherMarketId],
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
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, defaultAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId,
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
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, ZERO_BI);

      await eoaVault.setIsExternalRedemptionPaused(true);

      await eoaVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, eoaVault, borrowAccountNumber, otherMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId, otherAmountWei);
    });

    it('should fail when called by a contract', async () => {
      const transaction = await contractVault.populateTransaction.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectThrow(
        doAnything.callAnything(transaction.to!, transaction.data!),
        `IsolationModeVaultV1Pausable&Eoa: Only EOA can call <${doAnything.address.toLowerCase()}>`,
      );
    });
  });
});

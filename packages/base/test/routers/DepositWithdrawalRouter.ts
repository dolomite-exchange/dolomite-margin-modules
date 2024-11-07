import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupDAIBalance,
  setupTestMarket,
  setupUserVaultProxy
} from '../utils/setup';
import {
  CustomTestToken,
  TestDepositWithdrawalRouter,
  TestDepositWithdrawalRouter__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeVaultFactory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';

enum EventFlag {
  None = 0,
  Borrow = 1,
  Margin = 2,
}

const amountWei = ONE_ETH_BI;
const parAmount = parseEther('.5');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('DepositWithdrawalRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: TestDepositWithdrawalRouter;

  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let userVault: TestIsolationModeTokenVaultV1;
  let isolationModeMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);

    router = await createContractWithAbi<TestDepositWithdrawalRouter>(
      TestDepositWithdrawalRouter__factory.abi,
      TestDepositWithdrawalRouter__factory.bytecode,
      [core.tokens.weth.address, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );

    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();

    const userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV1',
      { ...libraries },
      []
    );
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation as any);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(router.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([router.address]);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#depositWei', () => {
    it('should work normally for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(core.marketIds.dai, defaultAccountNumber, amountWei, EventFlag.None);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectWalletBalance(router, core.tokens.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, ZERO_BI);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, defaultAccountNumber, amountWei, EventFlag.None);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally for isolation-mode asset and non-zero account number', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, borrowAccountNumber, amountWei, EventFlag.None);

      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work with sender balance for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(core.marketIds.dai, defaultAccountNumber, MAX_UINT_256_BI, EventFlag.None);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectWalletBalance(router, core.tokens.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, ZERO_BI);
    });

    it('should work with sender balance for isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, defaultAccountNumber, MAX_UINT_256_BI, EventFlag.None);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should emit a borrow event with borrow flag', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      const res = await router.depositWei(isolationModeMarketId, borrowAccountNumber, amountWei, EventFlag.Borrow);
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
      });
    });

    it('should fail if user does not have an isolation mode vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).depositWei(isolationModeMarketId, defaultAccountNumber, amountWei, EventFlag.None),
        'DepositWithdrawalRouter: No vault found for account'
      );
    });

    it('should fail with borrow or margin flag if account number if < 100', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);

      await expectThrow(
        router.depositWei(isolationModeMarketId, ONE_BI, amountWei, EventFlag.Borrow),
        'DepositWithdrawalRouter: Invalid toAccountNumber'
      );
    });

    it('should fail if market id does not exist', async () => {
      await expectThrow(
        router.depositWei(isolationModeMarketId.add(1), defaultAccountNumber, amountWei, EventFlag.None),
        'Getters: Invalid market'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositWei(
        core.marketIds.dai,
        defaultAccountNumber,
        amountWei,
        EventFlag.None
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#depositPayable', () => {
    it('should work normally', async () => {
      await router.depositPayable(defaultAccountNumber, { value: amountWei });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositPayable(defaultAccountNumber, { value: amountWei });
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#withdrawWei', () => {
    it('should work normally for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(core.marketIds.dai, defaultAccountNumber, amountWei, EventFlag.None);

      await router.withdrawWei(core.marketIds.dai, defaultAccountNumber, amountWei, BalanceCheckFlag.Both);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, amountWei);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, defaultAccountNumber, amountWei, EventFlag.None);

      await router.withdrawWei(isolationModeMarketId, defaultAccountNumber, amountWei, BalanceCheckFlag.Both);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should withdraw all for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(core.marketIds.dai, defaultAccountNumber, amountWei, EventFlag.None);

      await router.withdrawWei(core.marketIds.dai, defaultAccountNumber, MAX_UINT_256_BI, BalanceCheckFlag.Both);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, amountWei);
    });

    it('should withdraw all for isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, defaultAccountNumber, amountWei, EventFlag.None);

      await router.withdrawWei(isolationModeMarketId, defaultAccountNumber, MAX_UINT_256_BI, BalanceCheckFlag.Both);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail if withdrawing from borrow account number for isolation mode', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(isolationModeMarketId, borrowAccountNumber, amountWei, EventFlag.None);

      await expectThrow(
        router.withdrawWei(isolationModeMarketId, borrowAccountNumber, amountWei, BalanceCheckFlag.Both),
        'DepositWithdrawalRouter: Invalid fromAccountNumber'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawWei(
        core.marketIds.dai,
        defaultAccountNumber,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuard: reentrant call');
    });
  });

  describe('#withdrawPayable', () => {
    it('should work normally', async () => {
      await router.depositPayable(defaultAccountNumber, { value: amountWei });
      await expect(() => router.withdrawPayable(defaultAccountNumber, amountWei, BalanceCheckFlag.Both))
        .to.changeEtherBalance(core.hhUser1, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawPayable(
        defaultAccountNumber,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuard: reentrant call');
    });
  });

  describe('#depositPar', () => {
    it('should work normally with non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(core.marketIds.dai, defaultAccountNumber, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(isolationModeMarketId, defaultAccountNumber, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: defaultAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(parAmount);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, parAmount);
    });

    it('should work normally for non-isolation mode asset and non-zero account number', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(core.marketIds.dai, borrowAccountNumber, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should work normally for isolation-mode asset and non-zero account number', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(isolationModeMarketId, borrowAccountNumber, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: borrowAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositPar(
        core.marketIds.dai,
        defaultAccountNumber,
        parAmount,
        EventFlag.None
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuard: reentrant call');
    });
  });

  describe('#withdrawPar', () => {
    it('should work normally with non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(core.marketIds.dai, defaultAccountNumber, parAmount, EventFlag.None);

      await router.withdrawPar(core.marketIds.dai, defaultAccountNumber, parAmount, BalanceCheckFlag.Both);
      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(ZERO_BI);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(isolationModeMarketId, defaultAccountNumber, parAmount, EventFlag.None);

      await router.withdrawPar(isolationModeMarketId, defaultAccountNumber, parAmount, BalanceCheckFlag.Both);
      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: defaultAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(ZERO_BI);
    });

    it('should fail if withdrawing from borrow account number for isolation mode', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(isolationModeMarketId, defaultAccountNumber, parAmount, EventFlag.None);

      await expectThrow(
        router.withdrawPar(isolationModeMarketId, borrowAccountNumber, parAmount, BalanceCheckFlag.Both),
        'DepositWithdrawalRouter: Invalid fromAccountNumber'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawPar(
        core.marketIds.dai,
        defaultAccountNumber,
        parAmount,
        BalanceCheckFlag.Both
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuard: reentrant call');
    });
  });

  describe('#receive', () => {
    it('should fail if called by address other than WETH', async () => {
      await expectThrow(
        core.hhUser1.sendTransaction({ to: router.address, value: amountWei }),
        'DepositWithdrawalRouter: Invalid payable sender'
      );
    });
  });
});

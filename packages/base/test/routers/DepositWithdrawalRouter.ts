import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupDAIBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from '../utils/setup';
import {
  CustomTestToken,
  DolomiteAccountRegistry,
  TestDepositWithdrawalRouter,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeVaultFactory
} from 'packages/base/src/types';
import { createContractWithLibrary, createTestToken, withdrawFromDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createDolomiteAccountRegistryImplementation, createIsolationModeTokenVaultV1ActionsImpl, createTestDepositWithdrawalRouter } from '../utils/dolomite';
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

    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(dolomiteAccountRegistry.address);

    router = await createTestDepositWithdrawalRouter(core, core.tokens.weth);

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
      '100000000000000000000', // $100.00
    );
    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await factory.connect(core.governance).setAllowableCollateralMarketIds([isolationModeMarketId, core.marketIds.dai]);

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
      await router.depositWei(ZERO_BI, defaultAccountNumber, core.marketIds.dai, amountWei, EventFlag.None);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectWalletBalance(router, core.tokens.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, ZERO_BI);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally for isolation-mode asset and non-zero account number', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work with sender balance for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(ZERO_BI, defaultAccountNumber, core.marketIds.dai, MAX_UINT_256_BI, EventFlag.None);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectWalletBalance(router, core.tokens.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, ZERO_BI);
    });

    it('should work with sender balance for isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        MAX_UINT_256_BI,
        EventFlag.None
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should deposit other token directly into isolation mode vault', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        MAX_UINT_256_BI,
        EventFlag.None
      );

      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);
      await expectWalletBalance(router, core.tokens.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, ZERO_BI);
    });

    it('should allow paying back debt when borrowed asset has supply cap', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));
      await expectWalletBalance(core.hhUser1, core.tokens.dai, amountWei);

      // Set supply cap of DAI to 1 wei preventing deposits
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(core.marketIds.dai, ONE_BI);
      await core.tokens.dai.connect(core.hhUser1).approve(router.address, amountWei);
      await expectThrow(
        router.depositWei(isolationModeMarketId, defaultAccountNumber, core.marketIds.dai, amountWei, EventFlag.None),
        'OperationImpl: Total supply exceeds max supply <1>'
      );

      // Should still allow paying back debt
      await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        EventFlag.None
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should emit a borrow event with borrow flag', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      const res = await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.Borrow
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
      });
    });

    it('should fail if deposit is to invalid borrow account number', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, router);
      await expectThrow(
        router.depositWei(
          isolationModeMarketId,
          defaultAccountNumber,
          core.marketIds.weth,
          amountWei,
          EventFlag.None
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>'
      );
    });

    it('should fail if deposit into isolation mode vault is not valid', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, router);
      await expectThrow(
        router.depositWei(
          isolationModeMarketId,
          borrowAccountNumber,
          core.marketIds.weth,
          amountWei,
          EventFlag.None
        ),
        'IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <0>'
      );
    });

    it('should fail with borrow flag if account number if < 100', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);

      await expectThrow(
        router.depositWei(isolationModeMarketId, ONE_BI, isolationModeMarketId, amountWei, EventFlag.Borrow),
        'DepositWithdrawalRouter: Invalid toAccountNumber'
      );
    });

    it('should fail if market id does not exist', async () => {
      await expectThrow(
        router.depositWei(
          isolationModeMarketId,
          defaultAccountNumber,
          isolationModeMarketId.add(1),
          amountWei,
          EventFlag.None
        ),
        'Getters: Invalid market'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositWei(
        ZERO_BI,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        EventFlag.None
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#depositPayable', () => {
    it('should work normally', async () => {
      await router.depositPayable(ZERO_BI, defaultAccountNumber, EventFlag.None, { value: amountWei });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    });

    it('should work normally for isolation mode vault', async () => {
      await factory.connect(core.governance).setAllowableCollateralMarketIds(
        [isolationModeMarketId, core.marketIds.dai, core.marketIds.weth]
      );
      await router.depositPayable(isolationModeMarketId, borrowAccountNumber, EventFlag.None, { value: amountWei });
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositPayable(
        ZERO_BI,
        defaultAccountNumber,
        EventFlag.None,
        { value: amountWei }
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#withdrawWei', () => {
    it('should work normally for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(ZERO_BI, defaultAccountNumber, core.marketIds.dai, amountWei, EventFlag.None);

      await router.withdrawWei(ZERO_BI, defaultAccountNumber, core.marketIds.dai, amountWei, BalanceCheckFlag.Both);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, amountWei);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );

      await router.withdrawWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally for isolation mode vault and normal asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        EventFlag.None
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await expect(() => router.withdrawWei(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      )).to.changeTokenBalance(core.tokens.dai, core.hhUser1, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should withdraw all for non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositWei(ZERO_BI, defaultAccountNumber, core.marketIds.dai, amountWei, EventFlag.None);

      await router.withdrawWei(
        ZERO_BI,
        defaultAccountNumber,
        core.marketIds.dai,
        MAX_UINT_256_BI,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectWalletBalance(core.hhUser1, core.tokens.dai, amountWei);
    });

    it('should withdraw all for isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );

      await router.withdrawWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        MAX_UINT_256_BI,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(router, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should fail if withdrawing from borrow account number for isolation mode', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        EventFlag.None
      );

      await expectThrow(
        router.withdrawWei(
          isolationModeMarketId,
          borrowAccountNumber,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <123>'
      );
    });

    it('should fail if withdrawing from default account number for vault with normal asset', async () => {
      await expectThrow(
        router.withdrawWei(
          isolationModeMarketId,
          defaultAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.None
        ),
        `OperationImpl: Undercollateralized account <${userVault.address.toLowerCase()}, 0>`
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawWei(
        ZERO_BI,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuardUpgradeable: Reentrant call');
    });
  });

  describe('#withdrawPayable', () => {
    it('should work normally', async () => {
      await router.depositPayable(ZERO_BI, defaultAccountNumber, EventFlag.None, { value: amountWei });
      await expect(() => router.withdrawPayable(ZERO_BI, defaultAccountNumber, amountWei, BalanceCheckFlag.Both))
        .to.changeEtherBalance(core.hhUser1, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    });

    it('should work normally for isolation mode vault', async () => {
      await factory.connect(core.governance).setAllowableCollateralMarketIds(
        [isolationModeMarketId, core.marketIds.dai, core.marketIds.weth]
      );
      await router.depositPayable(isolationModeMarketId, borrowAccountNumber, EventFlag.None, { value: amountWei });
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);

      await expect(() => router.withdrawPayable(
        isolationModeMarketId,
        borrowAccountNumber,
        amountWei,
        BalanceCheckFlag.Both
      )).to.changeEtherBalance(core.hhUser1, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
    });

    it('should fail if withdrawing from default account number for iso vault', async () => {
      await expectThrow(
        router.withdrawPayable(isolationModeMarketId, defaultAccountNumber, amountWei, BalanceCheckFlag.Both),
        'DepositWithdrawalRouter: Invalid fromAccountNumber'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawPayable(
        ZERO_BI,
        defaultAccountNumber,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuardUpgradeable: Reentrant call');
    });
  });

  describe('#depositPar', () => {
    it('should work normally with non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(ZERO_BI, defaultAccountNumber, core.marketIds.dai, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        parAmount,
        EventFlag.None
      );

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: defaultAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(parAmount);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, parAmount);
    });

    it('should work normally for non-isolation mode asset and non-zero account number', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(ZERO_BI, borrowAccountNumber, core.marketIds.dai, parAmount, EventFlag.None);

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should work normally to deposit non-isolation mode asset into isolation mode vault', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        parAmount,
        EventFlag.None
      );

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: borrowAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should work normally for isolation-mode asset and non-zero account number', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(
        isolationModeMarketId,
        borrowAccountNumber,
        isolationModeMarketId,
        parAmount,
        EventFlag.None
      );

      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: borrowAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(parAmount);
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.depositPar(
        ZERO_BI,
        defaultAccountNumber,
        core.marketIds.dai,
        parAmount,
        EventFlag.None
      );
      await expectThrow(router.callFunctionAndTriggerReentrancy(transaction.data!), 'ReentrancyGuardUpgradeable: Reentrant call');
    });
  });

  describe('#withdrawPar', () => {
    it('should work normally with non-isolation mode asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(ZERO_BI, defaultAccountNumber, core.marketIds.dai, parAmount, EventFlag.None);

      await router.withdrawPar(ZERO_BI, defaultAccountNumber, core.marketIds.dai, parAmount, BalanceCheckFlag.Both);
      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: core.hhUser1.address, number: defaultAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(ZERO_BI);
    });

    it('should work normally for isolation-mode asset and account number 0', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(router.address, amountWei);
      await router.depositPar(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        parAmount,
        EventFlag.None
      );

      await router.withdrawPar(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        parAmount,
        BalanceCheckFlag.Both
      );
      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: defaultAccountNumber },
        isolationModeMarketId
      );
      expect(parValue.value).to.eq(ZERO_BI);
    });

    it('should work normally for isolation mode vault with normal asset', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, router);
      await router.depositPar(
        isolationModeMarketId,
        borrowAccountNumber, core.marketIds.dai, parAmount, EventFlag.None);

      await router.withdrawPar(
        isolationModeMarketId,
        borrowAccountNumber,
        core.marketIds.dai,
        parAmount,
        BalanceCheckFlag.Both
      );
      const parValue = await core.dolomiteMargin.getAccountPar(
        { owner: userVault.address, number: borrowAccountNumber },
        core.marketIds.dai
      );
      expect(parValue.value).to.eq(ZERO_BI);
    });

    it('should fail if withdrawing from borrow account number for isolation mode', async () => {
      await expectThrow(
        router.withdrawPar(
          isolationModeMarketId,
          borrowAccountNumber,
          isolationModeMarketId,
          parAmount,
          BalanceCheckFlag.Both
        ),
        'DepositWithdrawalRouter: Invalid fromAccountNumber'
      );
    });

    it('should fail if withdrawing from default account number for vault with normal asset', async () => {
      await expectThrow(
        router.withdrawPar(
          isolationModeMarketId,
          defaultAccountNumber,
          core.marketIds.dai,
          parAmount,
          BalanceCheckFlag.Both
        ),
        'DepositWithdrawalRouter: Invalid fromAccountNumber'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.withdrawPar(
        ZERO_BI,
        defaultAccountNumber,
        core.marketIds.dai,
        parAmount,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
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

import { Network, ONE_ETH_BI, TWO_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupDAIBalance,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from '../utils/setup';
import {
  CustomTestToken,
  TestBorrowPositionRouter,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeVaultFactory
} from 'packages/base/src/types';
import { createContractWithLibrary, createTestToken, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  createIsolationModeTokenVaultV1ActionsImpl,
  createTestBorrowPositionRouter,
} from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { parseEther } from 'ethers/lib/utils';

const amountWei = ONE_ETH_BI;
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const otherBorrowAccountNumber = BigNumber.from('456');

describe('BorrowPositionRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: TestBorrowPositionRouter;

  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let userVault: TestIsolationModeTokenVaultV1;
  let isolationModeMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 380_800_000,
    });
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);

    router = await createTestBorrowPositionRouter(core);

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
      '10000000000000000000', // $10.00
    );
    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(router.address, true);
    await factory.connect(core.governance).ownerInitialize([router.address]);
    await core.borrowPositionProxyV2.connect(core.governance).setIsCallerAuthorized(router.address, true);
    await core.gmxV2Ecosystem.live.gmEthUsd.factory.connect(core.governance).ownerSetIsTokenConverterTrusted(
      router.address,
      true
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#openBorrowPosition', () => {
    it('should work normally for a user for a normal asset', async () => {
      const res = await router.connect(core.hhUser1).openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.borrowPositionProxyV2, res, 'BorrowPositionOpen', {
        _borrower: core.hhUser1.address,
        _borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should work normally for a vault and the isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      const res = await router.openBorrowPosition(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.borrowPositionProxyV2, res, 'BorrowPositionOpen', {
        _borrower: userVault.address,
        _borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should work normally for a vault and a normal asset', async () => {
      const res = await router.connect(core.hhUser1).openBorrowPosition(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        borrower: userVault.address,
        borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should work normally with execution fee', async () => {
      const vaultAddress = await core.gmxV2Ecosystem.live.gmEthUsd.factory.calculateVaultByAccount(
        core.hhUser1.address
      );
      await setupGMBalance(
        core,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken,
        core.hhUser1,
        amountWei,
        core.depositWithdrawalRouter,
      );
      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        core.marketIds.dGmEthUsd,
        defaultAccountNumber,
        core.marketIds.dGmEthUsd,
        amountWei,
        0
      );
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, core.marketIds.dGmEthUsd, amountWei);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.dGmEthUsd, ZERO_BI);

      const res = await router.connect(core.hhUser1).openBorrowPosition(
        core.marketIds.dGmEthUsd,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dGmEthUsd,
        amountWei,
        BalanceCheckFlag.Both,
        { value: parseEther('0.001') }
      );
      await expectEvent(core.borrowPositionProxyV2, res, 'BorrowPositionOpen', {
        _borrower: vaultAddress,
        _borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, vaultAddress, defaultAccountNumber, core.marketIds.dGmEthUsd, ZERO_BI);
      await expectProtocolBalance(core, vaultAddress, borrowAccountNumber, core.marketIds.dGmEthUsd, amountWei);
    });

    it('should fail if msg.value > 0 for normal asset', async () => {
      await expectThrow(
        router.connect(core.hhUser1).openBorrowPosition(
          ZERO_BI,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both,
          { value: ONE_ETH_BI }
        ),
        'BorrowPositionRouter: Invalid msg.value'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#closeBorrowPosition', () => {
    it('should work normally for normal user and asset', async () => {
      const res = await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.borrowPositionProxyV2, res, 'BorrowPositionOpen', {
        _borrower: core.hhUser1.address,
        _borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.closeBorrowPosition(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally for vault and underlying asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await router.openBorrowPosition(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);

      await router.closeBorrowPosition(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        [],
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should work normally for vault and other token', async () => {
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.closeBorrowPosition(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should fail if market is not isolation mode', async () => {
      await expectThrow(
        router.closeBorrowPosition(
          core.marketIds.usdc,
          borrowAccountNumber,
          defaultAccountNumber,
          [],
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.closeBorrowPosition(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#transferBorrowPosition', () => {
    it('should work normally for one collateral and one debt', async () => {
      const wethAmount = parseEther('0.00001');
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount)
      );

      await core.dolomiteMargin.connect(core.hhUser2).setOperators([{
        operator: core.hhUser1.address,
        trusted: true,
      }]);
      const res = await router.transferBorrowPosition(
        borrowAccountNumber,
        core.hhUser2.address,
        borrowAccountNumber
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        borrower: core.hhUser2.address,
        borrowAccountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(
        core,
        core.hhUser2,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount)
      );
    });

    it('should fail if recipient is not a local operator', async () => {
      const wethAmount = parseEther('0.00001');
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount)
      );

      await expectThrow(
        router.transferBorrowPosition(
          borrowAccountNumber,
          core.hhUser2.address,
          borrowAccountNumber
        ),
        'BorrowPositionRouter: Invalid recipient'
      );
    });

    it('should fail if recipient has markets with balances', async () => {
      const wethAmount = parseEther('0.00001');
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(wethAmount)
      );

      await core.dolomiteMargin.connect(core.hhUser2).setOperators([{
        operator: core.hhUser1.address,
        trusted: true,
      }]);
      await setupWETHBalance(core, core.hhUser2, wethAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, wethAmount);

      await expectThrow(
        router.transferBorrowPosition(
          borrowAccountNumber,
          core.hhUser2.address,
          borrowAccountNumber
        ),
        'BorrowPositionRouter: Invalid recipient'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.transferBorrowPosition(
        borrowAccountNumber,
        core.hhUser2.address,
        borrowAccountNumber
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#transferBetweenAccounts', () => {
    it('should work normally for a normal asset', async () => {
      await router.transferBetweenAccounts(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should transfer underlying isolation asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should transfer other token between vault owner and vault', async () => {
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should fail if isolation mode market is not isolation mode', async () => {
      await expectThrow(
        router.transferBetweenAccounts(
          core.marketIds.usdc,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if if isolation mode market is market id and transferring between dolomite accounts', async () => {
      await expectThrow(
        router.transferBetweenAccounts(
          isolationModeMarketId,
          defaultAccountNumber,
          TWO_BI,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.None
        ),
        'BorrowPositionRouter: Invalid transfer between accounts'
      );
    });

    it('should fail if transferring a normal asset between two vault dolomite accounts', async () => {
      await expectThrow(
        router.transferBetweenAccounts(
          isolationModeMarketId,
          defaultAccountNumber,
          TWO_BI,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.None
        ),
        'BorrowPositionRouter: Invalid transfer between accounts'
      );
    });

    it('should fail if transferring a normal asset between two vault non-dolomite accounts', async () => {
      await expectThrow(
        router.transferBetweenAccounts(
          isolationModeMarketId,
          borrowAccountNumber,
          borrowAccountNumber.add(1),
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.None
        ),
        'BorrowPositionRouter: Invalid transfer between accounts'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.transferBetweenAccounts(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally for a normal asset', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei.mul(2));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));

      await router.repayAllForBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally for an isolation mode market', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei.mul(2));
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));

      await router.repayAllForBorrowPosition(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally when balance check is both', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei.mul(2));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));

      await router.repayAllForBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should fail if from balance check fails', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.mul(2));
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      // Remove 1 DAI + 1 wei from default account number so can't repay without going negative
      await router.transferBetweenAccounts(
        ZERO_BI,
        defaultAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.repayAllForBorrowPosition(
          ZERO_BI,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.From
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLocaleLowerCase()}, ${defaultAccountNumber.toString()}, ${core.marketIds.dai.toString()}>`
      );
    });

    it('should pass if to balance check passes', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.mul(2));
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      await router.repayAllForBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.To
      );
    });

    it('should fail if both balance check fails', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.mul(2));
      await router.openBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        ZERO_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      // Remove 1 DAI + 1 wei from default account number so can't repay without going negative
      await router.transferBetweenAccounts(
        ZERO_BI,
        defaultAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.repayAllForBorrowPosition(
          ZERO_BI,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLocaleLowerCase()}, ${defaultAccountNumber.toString()}, ${core.marketIds.dai.toString()}>`
      );
    });

    it('should fail if market is not isolation mode', async () => {
      await expectThrow(
        router.repayAllForBorrowPosition(
          core.marketIds.usdc,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.repayAllForBorrowPosition(
        ZERO_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });
});

import { MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
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
  TestBorrowPositionRouter,
  TestBorrowPositionRouter__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeVaultFactory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary, createTestToken, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { parseEther } from 'ethers/lib/utils';

enum Direction {
  ToVault = 0,
  FromVault = 1,
}

const amountWei = ONE_ETH_BI;
const parAmount = parseEther('.5');
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
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);

    router = await createContractWithAbi<TestBorrowPositionRouter>(
      TestBorrowPositionRouter__factory.abi,
      TestBorrowPositionRouter__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
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

    await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#openBorrowPosition', () => {
    it('should work normally for a user for a normal asset', async () => {
      const res = await router.openBorrowPosition(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: core.hhUser1.address,
        accountNumber: borrowAccountNumber,
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
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should work normally for a vault and a normal asset', async () => {
      await router.transferBetweenAccountsWithVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both,
        Direction.ToVault
      );

      const res = await router.openBorrowPosition(
        isolationModeMarketId,
        borrowAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: userVault.address,
        accountNumber: otherBorrowAccountNumber,
      });
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, otherBorrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.openBorrowPosition(
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

    it('should fail if user does not have an isolation mode vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).openBorrowPosition(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.openBorrowPosition(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#openBorrowPositionForVault', () => {
    it('should work normally', async () => {
      const res = await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: userVault.address,
        accountNumber: borrowAccountNumber,
      });

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.openBorrowPositionForVault(
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

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).openBorrowPositionForVault(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#closeBorrowPosition', () => {
    it('should work normally for normal user and asset', async () => {
      const res = await router.openBorrowPosition(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: core.hhUser1.address,
        accountNumber: borrowAccountNumber,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.closeBorrowPosition(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally for vault and isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

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
        [isolationModeMarketId]
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.closeBorrowPosition(
          core.marketIds.usdc,
          borrowAccountNumber,
          defaultAccountNumber,
          [core.marketIds.dai]
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).closeBorrowPosition(
          isolationModeMarketId,
          borrowAccountNumber,
          defaultAccountNumber,
          [core.marketIds.dai]
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.closeBorrowPosition(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#closeBorrowPositionForVault', () => {
    it('should work normally', async () => {
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.closeBorrowPositionForVault(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.closeBorrowPositionForVault(
          core.marketIds.usdc,
          borrowAccountNumber,
          defaultAccountNumber,
          [core.marketIds.dai]
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).closeBorrowPositionForVault(
          isolationModeMarketId,
          borrowAccountNumber,
          defaultAccountNumber,
          [core.marketIds.dai]
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.closeBorrowPositionForVault(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        [core.marketIds.dai]
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#transferBetweenAccounts', () => {
    it('should work normally for a normal asset', async () => {
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should work normally for an isolation mode asset', async () => {
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
    });

    it('should work for normal asset within isolation mode vault', async () => {
      await router.transferBetweenAccountsWithVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both,
        Direction.ToVault
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, otherBorrowAccountNumber, core.marketIds.dai, amountWei);
    });

    it('should fail if Market is not isolation mode', async () => {
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

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).transferBetweenAccounts(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.transferBetweenAccounts(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#transferBetweenAccountsWithVault', () => {
    it('should work normally', async () => {
      await router.transferBetweenAccountsWithVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both,
        Direction.ToVault
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, amountWei);

      await router.transferBetweenAccountsWithVault(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.Both,
        Direction.FromVault
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.transferBetweenAccountsWithVault(
          core.marketIds.usdc,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both,
          Direction.ToVault
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).transferBetweenAccountsWithVault(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          amountWei,
          BalanceCheckFlag.Both,
          Direction.ToVault
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.transferBetweenAccountsWithVault(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        BalanceCheckFlag.Both,
        Direction.ToVault
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally for a normal asset', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPosition(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
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

    it('should work normally when balance check is both', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPosition(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
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
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      // Remove 1 DAI + 1 wei from default account number so can't repay without going negative
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.repayAllForBorrowPosition(
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
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      await router.repayAllForBorrowPosition(
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
        MAX_UINT_256_BI,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      // Remove 1 DAI + 1 wei from default account number so can't repay without going negative
      await router.transferBetweenAccounts(
        MAX_UINT_256_BI,
        defaultAccountNumber,
        otherBorrowAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLocaleLowerCase()}, ${defaultAccountNumber.toString()}, ${core.marketIds.dai.toString()}>`
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.repayAllForBorrowPosition(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#repayAllForBorrowPositionForVault', () => {
    it('should work normally', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));

      await router.repayAllForBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);
    });

    it('should work normally when balance check is both', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(amountWei));

      await router.repayAllForBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, core.marketIds.dai, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, core.marketIds.weth, amountWei);
    });

    it('should fail if from balance check fails', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.mul(2));
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.To
      );

      await expectThrow(
        router.repayAllForBorrowPositionForVault(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.From
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLocaleLowerCase()}, ${defaultAccountNumber.toString()}, ${core.marketIds.dai.toString()}>`
      );
    });

    it('should pass if to balance check passes', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei,
        BalanceCheckFlag.To
      );

      await router.repayAllForBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.To
      );
    });

    it('should fail if both balance check fails', async () => {
      await setupWETHBalance(core, core.hhUser1, amountWei.mul(2), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei.mul(2));
      await router.openBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      await router.transferBetweenAccounts(
        isolationModeMarketId,
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.dai,
        amountWei.add(1),
        BalanceCheckFlag.To
      );

      await expectThrow(
        router.repayAllForBorrowPositionForVault(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLocaleLowerCase()}, ${defaultAccountNumber.toString()}, ${core.marketIds.dai.toString()}>`
      );
    });

    it('should fail if Market is not isolation mode', async () => {
      await expectThrow(
        router.repayAllForBorrowPositionForVault(
          core.marketIds.usdc,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if user does not have a vault', async () => {
      await expectThrow(
        router.connect(core.hhUser2).repayAllForBorrowPositionForVault(
          isolationModeMarketId,
          defaultAccountNumber,
          borrowAccountNumber,
          core.marketIds.dai,
          BalanceCheckFlag.Both
        ),
        'RouterBase: No vault for account'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await router.populateTransaction.repayAllForBorrowPositionForVault(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.dai,
        BalanceCheckFlag.Both
      );
      await expectThrow(
        router.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });
});

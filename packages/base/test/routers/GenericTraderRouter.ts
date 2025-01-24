import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupDAIBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUSDTBalance,
  setupUserVaultProxy,
} from '../utils/setup';
import {
  BorrowPositionRouter,
  CustomTestToken,
  GenericTraderProxyV2,
  SmartDebtAutoTrader,
  TestGenericTraderRouter,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin
} from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  createAndUpgradeDolomiteRegistry,
  createBorrowPositionRouter,
  createDolomiteAccountRegistryImplementation,
  createGenericTraderProxyV2,
  createIsolationModeTokenVaultV1ActionsImpl,
  createSmartDebtAutoTrader,
  createTestGenericTraderRouter
} from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { expectProtocolBalance, expectThrow, expectWalletBalance, expectWalletBalanceIsGreaterThan } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams } from '../utils/zap-utils';
import { expect } from 'chai';
import { PairType } from '../traders/SmartDebtAutoTrader';

const amountWei = ONE_ETH_BI;
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('GenericTraderRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let traderRouter: TestGenericTraderRouter;
  let borrowRouter: BorrowPositionRouter;
  let genericTraderProxy: GenericTraderProxyV2;

  let underlyingToken: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let userVault: TestIsolationModeTokenVaultV1;
  let isolationModeMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;

  let smartDebtAutoTrader: SmartDebtAutoTrader;

  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherToken2: CustomTestToken;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_470_000,
    });

    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(
      core.borrowPositionProxyV2.address
    );

    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);
    await createAndUpgradeDolomiteRegistry(core);

    smartDebtAutoTrader = await createSmartDebtAutoTrader(core);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(smartDebtAutoTrader.address, true);
    await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTraders(
      [smartDebtAutoTrader.address],
      [true]
    );
    await core.dolomiteRegistry.connect(core.governance).ownerSetSmartDebtTrader(smartDebtAutoTrader.address);

    const accountRegistry = await createDolomiteAccountRegistryImplementation();
    await core.dolomiteAccountRegistryProxy.connect(core.governance).upgradeTo(accountRegistry.address);

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

    genericTraderProxy = await createGenericTraderProxyV2(core, Network.ArbitrumOne);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    traderRouter = await createTestGenericTraderRouter(core, Network.ArbitrumOne);
    borrowRouter = await createBorrowPositionRouter(core);

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

    tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    tokenWrapper = await createContractWithAbi(
      TestIsolationModeWrapperTraderV2__factory.abi,
      TestIsolationModeWrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize(
      [tokenUnwrapper.address, tokenWrapper.address, traderRouter.address, borrowRouter.address]
    );

    await core.borrowPositionProxyV2.connect(core.governance).setIsCallerAuthorized(borrowRouter.address, true);
    await genericTraderProxy.connect(core.governance).setIsCallerAuthorized(traderRouter.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(traderRouter.address, true);

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

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await traderRouter.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await traderRouter.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await traderRouter.swapExactInputForOutput(
        ZERO_BI,
        {
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with isolation mode vault', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      await borrowRouter.transferBetweenAccounts(
        isolationModeMarketId,
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await traderRouter.swapExactInputForOutput(
        isolationModeMarketId,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should add collateral and swap for isolation mode vault', async () => {
      const fromAccountNumber = 3;

      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, fromAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, core.hhUser1, fromAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        isolationModeMarketId,
        outputAmount,
        tokenWrapper,
        core
      );
      await traderRouter.swapExactInputForOutput(
        isolationModeMarketId,
        {
          accountNumber: fromAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, fromAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, outputAmount);
    });

    it('should swap for isolation mode vault and remove collateral', async () => {
      const toAccountNumber = 4;
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core
      );
      await traderRouter.swapExactInputForOutput(
        isolationModeMarketId,
        {
          accountNumber: toAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, toAccountNumber, otherMarketId1, outputAmount);
    });

    it('should fail if msg.value is not 0 for non-isolation mode market', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        traderRouter.swapExactInputForOutput(
          ZERO_BI,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          },
          { value: ONE_ETH_BI }
        ),
        'GenericTraderRouter: msg.value must be 0'
      );
    });

    it('should fail if vault market id is not isolation mode', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        traderRouter.swapExactInputForOutput(
          otherMarketId1,
          {
            accountNumber: ZERO_BI,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'RouterBase: Market is not isolation mode'
      );
    });

    it('should fail if reentered', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await traderRouter.populateTransaction.swapExactInputForOutput(
        ZERO_BI,
        {
          accountNumber: ZERO_BI,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }
      );
      await expectThrow(
        traderRouter.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#swapExactInputForOutputAndModifyPosition', () => {
    it('should work normally for normal user', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await traderRouter.swapExactInputForOutputAndModifyPosition(
        ZERO_BI,
        {
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [{ marketId: otherMarketId2, amountWei: MAX_UINT_256_BI }],
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally to add collateral and swap to iso mode vault', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await traderRouter.swapExactInputForOutputAndModifyPosition(
        isolationModeMarketId,
        {
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [{ marketId: otherMarketId2, amountWei: MAX_UINT_256_BI }],
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally to swap and remove collateral from iso mode vault', async () => {
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core
      );
      await traderRouter.swapExactInputForOutputAndModifyPosition(
        isolationModeMarketId,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [{ marketId: otherMarketId1, amountWei: MAX_UINT_256_BI }],
            fromAccountNumber: borrowAccountNumber,
            toAccountNumber: defaultAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, outputAmount);
    });

    it('should work normally with transfers prior to swap', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        isolationModeMarketId,
        outputAmount,
        tokenWrapper,
        core
      );
      await traderRouter.swapExactInputForOutputAndModifyPosition(
        isolationModeMarketId,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei },
              { marketId: isolationModeMarketId, amountWei: amountWei }
            ],
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei.add(outputAmount)
      );
    });

    it('should work normally with transfers after swap', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await traderRouter.swapExactInputForOutputAndModifyPosition(
        isolationModeMarketId,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [
              { marketId: otherMarketId2, amountWei: outputAmount },
              { marketId: isolationModeMarketId, amountWei: amountWei }
            ],
            fromAccountNumber: borrowAccountNumber,
            toAccountNumber: defaultAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should fail if msg.value is not 0 for non-isolation mode market', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        traderRouter.swapExactInputForOutputAndModifyPosition(
          ZERO_BI,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              transferAmounts: [{ marketId: otherMarketId2, amountWei: MAX_UINT_256_BI }],
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
            },
            expiryParams: {
              expiryTimeDelta: 0,
              marketId: 0,
            },
            userConfig: zapParams.userConfig,
          },
          { value: ONE_ETH_BI }
        ),
        'GenericTraderRouter: msg.value must be 0'
      );
    });

    it('should fail if reentered', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await traderRouter.populateTransaction.swapExactInputForOutputAndModifyPosition(
        ZERO_BI,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            transferAmounts: [{ marketId: otherMarketId1, amountWei: MAX_UINT_256_BI }],
            fromAccountNumber: borrowAccountNumber,
            toAccountNumber: defaultAccountNumber,
          },
          expiryParams: {
            expiryTimeDelta: 0,
            marketId: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectThrow(
        traderRouter.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe.only('#swapExactInputForOutputViaSmartAccount', () => {
    it('should work normally with one swap', async () => {
      await disableInterestAccrual(core, core.marketIds.usdc);
      await disableInterestAccrual(core, core.marketIds.usdt);

      const usdcAmount = BigNumber.from('100000000');
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, traderRouter);

      const usdtAmount = BigNumber.from('200000000');
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);

      await smartDebtAutoTrader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await smartDebtAutoTrader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      await traderRouter.swapExactInputForOutputViaSmartAccount(
        core.tokens.usdc.address,
        core.tokens.usdt.address,
        usdcAmount,
        ONE_BI,
        [{
          user: core.hhUser2.address,
          accountNumber: defaultAccountNumber,
          amount: usdcAmount,
        }]
      );

      const usdtBal = await core.tokens.usdt.balanceOf(core.hhUser1.address);
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, ZERO_BI);
      await expectWalletBalanceIsGreaterThan(core.hhUser1, core.tokens.usdt, usdcAmount);

      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(
        core,
        core.hhUser2,
        defaultAccountNumber,
        core.marketIds.usdt,
        usdtAmount.sub(usdtBal)
      );
    });

    it('should work normally with two swaps', async () => {
      await disableInterestAccrual(core, core.marketIds.usdc);
      await disableInterestAccrual(core, core.marketIds.usdt);

      const usdcAmount = BigNumber.from('100000000');
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, traderRouter);

      const usdtAmount = BigNumber.from('200000000');
      await setupUSDTBalance(core, core.hhUser2, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.usdt, usdtAmount);
      await setupUSDTBalance(core, core.hhUser3, usdtAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser3, 0, core.marketIds.usdt, usdtAmount);

      await smartDebtAutoTrader.connect(core.governance).ownerAddSmartCollateralPair(core.marketIds.usdc, core.marketIds.usdt);
      await smartDebtAutoTrader.connect(core.hhUser2).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );
      await smartDebtAutoTrader.connect(core.hhUser3).userSetPair(
        defaultAccountNumber,
        PairType.SMART_COLLATERAL,
        core.marketIds.usdc,
        core.marketIds.usdt
      );

      await traderRouter.swapExactInputForOutputViaSmartAccount(
        core.tokens.usdc.address,
        core.tokens.usdt.address,
        usdcAmount,
        ONE_BI,
        [
          {
            user: core.hhUser2.address,
            accountNumber: defaultAccountNumber,
            amount: usdcAmount.div(2),
          },
          {
            user: core.hhUser3.address,
            accountNumber: defaultAccountNumber,
            amount: usdcAmount.div(2),
          },
        ]
      );

      const usdtBal = await core.tokens.usdt.balanceOf(core.hhUser1.address);
      await expectWalletBalance(core.hhUser1, core.tokens.usdc, ZERO_BI);
      await expectWalletBalanceIsGreaterThan(core.hhUser1, core.tokens.usdt, usdcAmount);

      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount.div(2));
      await expectProtocolBalance(
        core,
        core.hhUser2,
        defaultAccountNumber,
        core.marketIds.usdt,
        usdtAmount.sub(usdtBal.div(2))
      );
      await expectProtocolBalance(core, core.hhUser3, defaultAccountNumber, core.marketIds.usdc, usdcAmount.div(2));
      await expectProtocolBalance(
        core,
        core.hhUser3,
        defaultAccountNumber,
        core.marketIds.usdt,
        usdtAmount.sub(usdtBal.div(2))
      );
    });
  });
});

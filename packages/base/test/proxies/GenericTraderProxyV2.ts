import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupDAIBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '../utils/setup';
import {
  BorrowPositionRouter,
  CustomTestToken,
  GenericTraderProxyV2,
  TestBorrowPositionRouter__factory,
  TestGenericTraderProxyV2,
  TestGenericTraderRouter,
  TestGenericTraderRouter__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeTokenVaultV2,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary, createContractWithName, createTestToken, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { getBlockTimestamp, getLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { createAndUpgradeDolomiteRegistry, createIsolationModeTokenVaultV2ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { expectProtocolBalance, expectThrow } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { parseEther } from 'ethers/lib/utils';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams, ZapParam } from '../utils/zap-utils';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

const amountWei = ONE_ETH_BI;
const outputAmount = parseEther('.5');
const parAmount = parseEther('.5');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const otherBorrowAccountNumber = BigNumber.from('456');

describe('GenericTraderProxyV2', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let traderRouter: TestGenericTraderRouter;
  let borrowRouter: BorrowPositionRouter;
  let genericTraderProxy: TestGenericTraderProxyV2;

  let underlyingToken: CustomTestToken;
  let underlyingToken2: CustomTestToken;
  let factory: TestIsolationModeVaultFactory;
  let factory2: TestIsolationModeVaultFactory;
  let userVault: TestIsolationModeTokenVaultV2;
  let isolationModeMarketId: BigNumber;
  let isolationModeMarketId2: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;

  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherToken2: CustomTestToken;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);

    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(core.borrowPositionProxyV2.address);

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

    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    genericTraderProxy = await createContractWithLibrary(
      'TestGenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [Network.ArbitrumOne, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    traderRouter = await createContractWithAbi<TestGenericTraderRouter>(
      TestGenericTraderRouter__factory.abi,
      TestGenericTraderRouter__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    borrowRouter = await createContractWithAbi<BorrowPositionRouter>(
      TestBorrowPositionRouter__factory.abi,
      TestBorrowPositionRouter__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );

    const libraries = await createIsolationModeTokenVaultV2ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV2',
      { ...libraries },
      []
    );

    underlyingToken = await createTestToken();
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation as any);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '10000000000000000000', // $10.00
    );
    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    underlyingToken2 = await createTestToken();
    factory2 = await createTestIsolationModeVaultFactory(core, underlyingToken2, userVaultImplementation as any);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory2.address,
      '10000000000000000000', // $10.00
    );
    isolationModeMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory2, true);

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
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address, tokenWrapper.address, traderRouter.address, borrowRouter.address]);

    await core.borrowPositionProxyV2.connect(core.governance).setIsCallerAuthorized(borrowRouter.address, true);
    await genericTraderProxy.connect(core.governance).setIsCallerAuthorized(traderRouter.address, true);
    await genericTraderProxy.connect(core.governance).setIsCallerAuthorized(core.hhUser5.address, true);

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

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await genericTraderProxy.CHAIN_ID()).to.equal(Network.ArbitrumOne);
      expect(await genericTraderProxy.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await genericTraderProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally to transfer users full balance', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with balance check both', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.Both;
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with balance check from', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.From;
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally for internal liquidity', async () => {

    });

    it('should work normally for iso mode to iso mode', async () => {

    });

    it('should work normally with unwrapping', async () => {
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      const zapParams = await getUnwrapZapParams(isolationModeMarketId, amountWei, otherMarketId1, outputAmount, tokenUnwrapper, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, outputAmount);
    });

    it('should work normally with wrapping', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getWrapZapParams(otherMarketId1, amountWei, isolationModeMarketId, outputAmount, tokenWrapper, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
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
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, outputAmount);
    });

    it('should fail if marketIds path is less than 2', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath.slice(0, 1),
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid market path length'
      );
    });

    it('should fail if input amount is max uint256 and balance is negative', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);
      await borrowRouter.transferBetweenAccounts(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        ONE_BI,
        BalanceCheckFlag.To,
      );

      const zapParams = await getSimpleZapParams(otherMarketId2, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: MAX_UINT_256_BI,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        `GenericTraderProxyV2: Balance must be positive <${otherMarketId2.toString()}>`
      );
    });

    it('should fail if input amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: ZERO_BI,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid inputAmountWei'
      );
    });

    it('should fail if min output amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: ZERO_BI,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid minOutputAmountWei'
      );
    });

    it('should fail if traders path is incorrect length', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: [otherMarketId1, otherMarketId2, otherMarketId1],
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid traders params length'
      );
    });

    it('should fail if trader is address zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.tradersPath[0].trader = ADDRESS_ZERO;
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid trader at index <0>'
      );
    });

    it('should fail if unwrapping isolation mode with invalid unwrapper', async () => {
      const zapParams = await getSimpleZapParams(isolationModeMarketId, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid isolation mode unwrapper <52, 0>'
      );
    });

    it('should fail if unwrapping iso mode to iso mode with invalid token converter', async () => {
      const zapParams = await getUnwrapZapParams(isolationModeMarketId, amountWei, isolationModeMarketId2, outputAmount, tokenUnwrapper, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid unwrap sequence <52, 53>'
      );
    });

    it('should fail if wrapping iso mode to non-iso mode with invalid wrapper', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, isolationModeMarketId, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid isolation mode wrapper <52, 0>'
      );
    });

    it('should fail if using iso mode trader for non-iso mode market', async () => {
      const zapParams = await getWrapZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, tokenWrapper, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyBase: Invalid trader type <3>'
      );
    });

    it('should fail if expired', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.deadline = 0;

      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
      );
    });

    it('should fail if reentrancy is triggered', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await genericTraderProxy.populateTransaction.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      await expectThrow(
        genericTraderProxy.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#swapExactInputForOutputForDifferentAccount', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
        core.hhUser1.address,
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

    it('should work normally with balance check both', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.Both;
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
        core.hhUser1.address,
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

    it('should work normally with balance check from', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.From;
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
        core.hhUser1.address,
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

    it('should work normally for internal liquidity', async () => {

    });

    it('should work normally for iso mode to iso mode', async () => {

    });

    it('should fail if marketIds path is less than 2', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath.slice(0, 1),
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid market path length'
      );
    });

    it('should fail if input amount is max uint256 and balance is negative', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);
      await borrowRouter.transferBetweenAccounts(
        MAX_UINT_256_BI,
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        ONE_BI,
        BalanceCheckFlag.To,
      );

      const zapParams = await getSimpleZapParams(otherMarketId2, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: borrowAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: MAX_UINT_256_BI,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        `GenericTraderProxyV2: Balance must be positive <${otherMarketId2.toString()}>`
      );
    });

    it('should fail if input amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: ZERO_BI,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid inputAmountWei'
      );
    });

    it('should fail if min output amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: ZERO_BI,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid minOutputAmountWei'
      );
    });

    it('should fail if traders path is incorrect length', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: [otherMarketId1, otherMarketId2, otherMarketId1],
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid traders params length'
      );
    });

    it('should fail if trader is address zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.tradersPath[0].trader = ADDRESS_ZERO;
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader at index <0>'
      );
    });

    it('should fail if unwrapping isolation mode with invalid unwrapper', async () => {
      const zapParams = await getSimpleZapParams(isolationModeMarketId, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode unwrapper <52, 0>'
      );
    });

    it('should fail if unwrapping iso mode to iso mode with invalid token converter', async () => {
      const zapParams = await getUnwrapZapParams(isolationModeMarketId, amountWei, isolationModeMarketId2, outputAmount, tokenUnwrapper, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid unwrap sequence <52, 53>'
      );
    });

    it('should fail if wrapping iso mode to non-iso mode with invalid wrapper', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, isolationModeMarketId, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode wrapper <52, 0>'
      );
    });

    it('should fail if using iso mode trader for non-iso mode market', async () => {
      const zapParams = await getWrapZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, tokenWrapper, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader type <3>'
      );
    });

    it('should fail if expired', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.deadline = 0;
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
      );
    });

    it('should fail if reentrancy is triggered', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await genericTraderProxy.populateTransaction.swapExactInputForOutputForDifferentAccount(
        core.hhUser1.address,
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
      await expectThrow(
        genericTraderProxy.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });

    it('should fail if caller is not authorized', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser2).swapExactInputForOutputForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            userConfig: zapParams.userConfig,
          }
        ),
        `AuthorizationBase: unauthorized <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#swapExactInputForOutputAndModifyPosition', () => {
    it('should work normally with swap into trade account', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with swap out of trade account', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: borrowAccountNumber,
          toAccountNumber: defaultAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId2, amountWei: MAX_UINT_256_BI }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally to swap full position', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken2.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId2, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: borrowAccountNumber,
          toAccountNumber: defaultAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId2, amountWei: MAX_UINT_256_BI.sub(ONE_BI) }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should fail if swapping full position but market id is not last market id', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition({
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: borrowAccountNumber,
            toAccountNumber: defaultAccountNumber,
            transferAmounts: [
              { marketId: core.marketIds.dai, amountWei: MAX_UINT_256_BI.sub(ONE_BI) }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }),
        `GenericTraderProxyV2: Invalid transfer marketId <${core.marketIds.dai.toString()}>`
      );
    });

    it('should fail if swapping full position but from account is not trade account', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition({
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId2, amountWei: MAX_UINT_256_BI.sub(ONE_BI) }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyV2: Invalid from account ID'
      );
    });

    it('should work normally with from balance check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.From;
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with to balance check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.To;
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with both transfer check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.Both;
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with expiry', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
        accountNumber: borrowAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: otherMarketId2,
          expiryTimeDelta: 1000,
        },
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should fail if market id path is less than 2', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: [],
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid market path length'
      );
    });

    it('should fail if no transfer amounts', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid transfer amounts length'
      );
    });

    it('should fail if from and to account numbers are the same', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: defaultAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Cannot transfer to same account'
      );
    });

    it('should fail if trade account number is not from or to account number', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: ONE_BI,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid trade account number'
      );
    });

    it('should fail if transfer amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: ZERO_BI }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid transfer amount at index <0>'
      );
    });

    it('should fail if input amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: ZERO_BI,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid inputAmountWei'
      );
    });

    it('should fail if min output amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: ZERO_BI,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid minOutputAmountWei'
      );
    });

    it('should fail if traders path is incorrect length', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: [otherMarketId1, otherMarketId2, otherMarketId1],
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid traders params length'
      );
    });

    it('should fail if trader is address zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.tradersPath[0].trader = ADDRESS_ZERO;

      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader at index <0>'
      );
    });

    it('should fail if unwrapping isolation mode with invalid unwrapper', async () => {
      const zapParams = await getSimpleZapParams(isolationModeMarketId, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode unwrapper <52, 0>'
      );
    });

    it('should fail if unwrapping iso mode to iso mode with invalid token converter', async () => {
      const zapParams = await getUnwrapZapParams(isolationModeMarketId, amountWei, isolationModeMarketId2, outputAmount, tokenUnwrapper, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid unwrap sequence <52, 53>'
      );
    });

    it('should fail if wrapping iso mode to non-iso mode with invalid wrapper', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, isolationModeMarketId, outputAmount, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode wrapper <52, 0>'
      );
    });

    it('should fail if using iso mode trader for non-iso mode market', async () => {
      const zapParams = await getWrapZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, tokenWrapper, core);
      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader type <3>'
      );
    });

    it('should fail if expired', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.deadline = 0;

      await expectThrow(
        genericTraderProxy.swapExactInputForOutputAndModifyPosition(
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
      );
    });

    it('should fail if reentrancy is triggered', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await genericTraderProxy.populateTransaction.swapExactInputForOutputAndModifyPosition({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        transferCollateralParams: {
          fromAccountNumber: defaultAccountNumber,
          toAccountNumber: borrowAccountNumber,
          transferAmounts: [
            { marketId: otherMarketId1, amountWei: amountWei }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectThrow(
        genericTraderProxy.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });

  describe('#swapExactInputForOutputAndModifyPositionForDifferentAccount', () => {
    it('should work normally for transfer into trade account', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with swap out of trade account', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: borrowAccountNumber,
            toAccountNumber: defaultAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId2, amountWei: MAX_UINT_256_BI }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with from balance check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.From;
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with to balance check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.To;
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally with from balance check', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.balanceCheckFlag = BalanceCheckFlag.Both;
      await genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: borrowAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should fail if market id path is less than 2', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: [],
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid market path length'
      );
    });

    it('should fail if no transfer amounts', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid transfer amounts length'
      );
    });

    it('should fail if from and to account numbers are the same', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: defaultAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Cannot transfer to same account'
      );
    });

    it('should fail if trade account number is not from or to account number', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: ONE_BI,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid trade account number'
      );
    });

    it('should fail if transfer amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: ZERO_BI }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyV2: Invalid transfer amount at index <0>'
      );
    });

    it('should fail if input amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: ZERO_BI,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid inputAmountWei'
      );
    });

    it('should fail if min output amount is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: ZERO_BI,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid minOutputAmountWei'
      );
    });

    it('should fail if traders path is incorrect length', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: [otherMarketId1, otherMarketId2, otherMarketId1],
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid traders params length'
      );
    });

    it('should fail if trader is address zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.tradersPath[0].trader = ADDRESS_ZERO;

      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader at index <0>'
      );
    });

    it('should fail if unwrapping isolation mode with invalid unwrapper', async () => {
      const zapParams = await getSimpleZapParams(isolationModeMarketId, amountWei, otherMarketId1, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode unwrapper <52, 0>'
      );
    });

    it('should fail if unwrapping iso mode to iso mode with invalid token converter', async () => {
      const zapParams = await getUnwrapZapParams(isolationModeMarketId, amountWei, isolationModeMarketId2, outputAmount, tokenUnwrapper, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid unwrap sequence <52, 53>'
      );
    });

    it('should fail if wrapping iso mode to non-iso mode with invalid wrapper', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, isolationModeMarketId, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid isolation mode wrapper <52, 0>'
      );
    });

    it('should fail if using iso mode trader for non-iso mode market', async () => {
      const zapParams = await getWrapZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, tokenWrapper, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        'GenericTraderProxyBase: Invalid trader type <3>'
      );
    });

    it('should fail if unauthorized', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        genericTraderProxy.connect(core.hhUser2).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
        `AuthorizationBase: unauthorized <${core.hhUser2.address.toLowerCase()}>`
      );
    })

    it('should fail if expired', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.deadline = 0;

      await expectThrow(
        genericTraderProxy.connect(core.hhUser5).swapExactInputForOutputAndModifyPositionForDifferentAccount(
          core.hhUser1.address,
          {
            accountNumber: defaultAccountNumber,
            marketIdsPath: zapParams.marketIdsPath,
            inputAmountWei: zapParams.inputAmountWei,
            minOutputAmountWei: zapParams.minOutputAmountWei,
            tradersPath: zapParams.tradersPath,
            makerAccounts: zapParams.makerAccounts,
            transferCollateralParams: {
              fromAccountNumber: defaultAccountNumber,
              toAccountNumber: borrowAccountNumber,
              transferAmounts: [
                { marketId: otherMarketId1, amountWei: amountWei }
              ],
            },
            expiryParams: {
              marketId: 0,
              expiryTimeDelta: 0,
            },
            userConfig: zapParams.userConfig,
          }
        ),
      );
    });

    it('should fail if reentrancy is triggered', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const transaction = await genericTraderProxy.populateTransaction.swapExactInputForOutputAndModifyPositionForDifferentAccount(
        core.hhUser1.address,
        {
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          transferCollateralParams: {
            fromAccountNumber: defaultAccountNumber,
            toAccountNumber: borrowAccountNumber,
            transferAmounts: [
              { marketId: otherMarketId1, amountWei: amountWei }
            ],
          },
          expiryParams: {
            marketId: 0,
            expiryTimeDelta: 0,
          },
          userConfig: zapParams.userConfig,
        }
      );
      await expectThrow(
        genericTraderProxy.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuard: reentrant call'
      );
    });
  });
});

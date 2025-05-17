import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
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
  TestBorrowPositionRouter__factory,
  TestDolomiteAutoTrader,
  TestDolomiteAutoTrader__factory,
  TestGenericTraderProxyV2,
  TestGenericTraderRouter,
  TestGenericTraderRouter__factory,
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
  createContractWithName,
  createTestToken,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createAndUpgradeDolomiteRegistry, createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../utils/ecosystem-utils/testers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { parseEther } from 'ethers/lib/utils';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams } from '../utils/zap-utils';
import { expect } from 'chai';
import {
  GenericEventEmissionType,
  GenericTraderParam,
  GenericTraderType,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';

const amountWei = ONE_ETH_BI;
const outputAmount = parseEther('.5');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

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
  let userVault: TestIsolationModeTokenVaultV1;
  let isolationModeMarketId: BigNumber;
  let isolationModeMarketId2: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;

  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherToken2: CustomTestToken;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_476_000,
    });
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.usdt);

    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetBorrowPositionProxy(
      core.borrowPositionProxyV2.address
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

    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    genericTraderProxy = await createContractWithLibrary(
      'TestGenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
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

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary(
      'TestIsolationModeTokenVaultV1',
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
    await factory.connect(core.governance).ownerInitialize(
      [tokenUnwrapper.address, tokenWrapper.address, traderRouter.address, borrowRouter.address],
    );

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
      expect(await genericTraderProxy.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await genericTraderProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: amountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
    });

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

    xit('should work with internal liquidity', async () => {
      const dolomiteAutoTrader = await createContractWithAbi<TestDolomiteAutoTrader>(
        TestDolomiteAutoTrader__factory.abi,
        TestDolomiteAutoTrader__factory.bytecode,
        [],
      );
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteAutoTrader.address, true);
      await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTraders(
        [dolomiteAutoTrader.address],
        [true]
      );

      const usdcAmount = BigNumber.from('100000000');
      await setupUSDTBalance(core, core.hhUser2, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdt, usdcAmount);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdt, usdcAmount);

      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await disableInterestAccrual(core, core.marketIds.usdc);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const zapParams = await getSimpleZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        ONE_BI,
        core,
      );
      zapParams.tradersPath[0].trader = dolomiteAutoTrader.address;
      zapParams.tradersPath[0].traderType = GenericTraderType.InternalLiquidity;
      zapParams.tradersPath[0].tradeData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [usdcAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [BigNumber.from('4321')])],
      );
      zapParams.makerAccounts.push({
        owner: core.hhUser2.address,
        number: defaultAccountNumber,
      });
      await genericTraderProxy.swapExactInputForOutput({
        accountNumber: defaultAccountNumber,
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        userConfig: zapParams.userConfig,
      });

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdt, usdcAmount);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdt, ZERO_BI);
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

    it('should work normally with unwrapping', async () => {
      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core,
      );
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

      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        isolationModeMarketId,
        outputAmount,
        tokenWrapper,
        core,
      );
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

    it('should work normally for multiple markets', async () => {
      const outputAmount = ONE_BI;
      const traderParams: GenericTraderParam[] = [
        {
          trader: core.testEcosystem!.testExchangeWrapper.address,
          traderType: GenericTraderType.ExternalLiquidity,
          makerAccountIndex: 0,
          tradeData: ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [outputAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [outputAmount])],
          )
        },
        {
          trader: tokenWrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          makerAccountIndex: 0,
          tradeData: ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [outputAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [outputAmount])],
          )
        }
      ];
      const zapParams = {
        inputAmountWei: amountWei,
        minOutputAmountWei: outputAmount,
        marketIdsPath: [otherMarketId2, otherMarketId1, isolationModeMarketId],
        tradersPath: traderParams,
        makerAccounts: [],
        userConfig: {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      };

      await otherToken2.addBalance(core.hhUser1.address, amountWei);
      await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.None,
      );

      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, outputAmount);
    });

    it('should fail with internal liquidity if trader is not trusted', async () => {
      const dolomiteAutoTrader = await createContractWithAbi<TestDolomiteAutoTrader>(
        TestDolomiteAutoTrader__factory.abi,
        TestDolomiteAutoTrader__factory.bytecode,
        [],
      );
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(dolomiteAutoTrader.address, true);

      const usdcAmount = BigNumber.from('100000000');
      await setupUSDTBalance(core, core.hhUser2, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdt, usdcAmount);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdt, usdcAmount);

      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await disableInterestAccrual(core, core.marketIds.usdc);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const zapParams = await getSimpleZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.usdt,
        ONE_BI,
        core,
      );
      zapParams.tradersPath[0].trader = dolomiteAutoTrader.address;
      zapParams.tradersPath[0].traderType = GenericTraderType.InternalLiquidity;
      zapParams.tradersPath[0].tradeData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [usdcAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [BigNumber.from('4321')])],
      );
      zapParams.makerAccounts.push({
        owner: core.hhUser2.address,
        number: defaultAccountNumber,
      });
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
        'GenericTraderProxyBase: Internal trader not whitelisted'
      );
    });

    it('should fail at unwrapper if token converter is trusted for isolation mode to isolation mode', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory2.address, true);
      await factory2.connect(core.governance).ownerInitialize(
        [tokenUnwrapper.address, tokenWrapper.address, traderRouter.address, borrowRouter.address]
      );
      await tokenUnwrapper.addOutputToken(factory2.address);

      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        isolationModeMarketId2,
        outputAmount,
        tokenUnwrapper,
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
      );
    });

    it('should fail if wrapper is not the last trader', async () => {
      const traderParams: GenericTraderParam[] = [
        {
          trader: tokenWrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          makerAccountIndex: 0,
          tradeData: ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [outputAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [outputAmount])],
          )
        },
        {
          trader: tokenUnwrapper.address,
          traderType: GenericTraderType.IsolationModeUnwrapper,
          makerAccountIndex: 0,
          tradeData: ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [outputAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [outputAmount])],
          )
        }
      ];
      const zapParams = {
        inputAmountWei: amountWei,
        minOutputAmountWei: outputAmount,
        marketIdsPath: [otherMarketId1, isolationModeMarketId, otherMarketId1],
        tradersPath: traderParams,
        makerAccounts: [],
        userConfig: {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      };
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
        'GenericTraderProxyBase: Wrapper must be the last trader'
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

    it('should work normally to emit BorrowPositionOpen event', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.eventType = GenericEventEmissionType.BorrowPosition;
      const res = await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
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
      await expectEvent(core.eventEmitterRegistry, res, 'BorrowPositionOpen', {
        accountOwner: core.hhUser1.address,
        accountNumber: borrowAccountNumber,
      });

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally to emit MarginPositionOpen event', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.eventType = GenericEventEmissionType.MarginPosition;
      const res = await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
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
      await expectEvent(core.eventEmitterRegistry, res, 'MarginPositionOpen', {});

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work normally to emit MarginPositionClose event', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.userConfig.eventType = GenericEventEmissionType.MarginPosition;
      const res = await genericTraderProxy.swapExactInputForOutputAndModifyPosition({
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
            { marketId: otherMarketId2, amountWei: outputAmount }
          ],
        },
        expiryParams: {
          marketId: 0,
          expiryTimeDelta: 0,
        },
        userConfig: zapParams.userConfig,
      });
      await expectEvent(core.eventEmitterRegistry, res, 'MarginPositionClose', {});

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
    });

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
      const transaction = await genericTraderProxy.populateTransaction
        .swapExactInputForOutputAndModifyPositionForDifferentAccount(
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

  describe('#_validateMarketIdPath', () => {
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
  });

  describe('#_getActualInputAmountWei', () => {
    it('should fail if input amount is max uint256 and balance is negative', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, otherMarketId1, amountWei);
      await borrowRouter.transferBetweenAccounts(
        ZERO_BI,
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
  });

  describe('#_validateAmountWeis', () => {
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
  });

  describe('#_validateTraderParams', () => {
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
        'GenericTraderProxyV2Lib: Invalid traders params length'
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
        'GenericTraderProxyV2Lib: Invalid trader at index <0>'
      );
    });
  });

  describe('#_validateIsolationModeStatusForTraderParam', () => {
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
        'GenericTraderProxyV2Lib: Invalid isolation mode unwrapper <52, 0>'
      );
    });

    it('should fail if unwrapping iso mode to iso mode with invalid token converter', async () => {
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        isolationModeMarketId2,
        outputAmount,
        tokenUnwrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid unwrap sequence <52, 53>'
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
        'GenericTraderProxyV2Lib: Invalid isolation mode wrapper <52, 0>'
      );
    });

    it('should fail if using iso mode trader for non-iso mode market', async () => {
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        otherMarketId2,
        outputAmount,
        tokenWrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid trader type <3>'
      );
    });
  });

  describe('#_validateTraderTypeForTraderParam', () => {
    it('should fail if invalid input for isolation mode unwrapper', async () => {
      const zapParams = await getUnwrapZapParams(
        core.marketIds.dArb,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid input for unwrapper <0, 28>'
      );
    });

    it('should fail if invalid output for isolation mode unwrapper', async () => {
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        core.marketIds.weth,
        outputAmount,
        tokenUnwrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid output for unwrapper <1, 0>'
      );
    });

    it('should fail if unwrapper is not trusted', async () => {
      const badTokenUnwrapper = await createContractWithAbi<TestIsolationModeUnwrapperTraderV2>(
        TestIsolationModeUnwrapperTraderV2__factory.abi,
        TestIsolationModeUnwrapperTraderV2__factory.bytecode,
        [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
      );
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        badTokenUnwrapper,
        core
      );

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
        `GenericTraderProxyV2Lib: Unwrapper trader not enabled <${badTokenUnwrapper.address.toLowerCase()}, 52>`
      );
    });

    it('should fail if invalid input for isolation mode wrapper', async () => {
      const zapParams = await getWrapZapParams(
        core.marketIds.weth,
        amountWei,
        isolationModeMarketId,
        outputAmount,
        tokenWrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid input for wrapper <0, 0>'
      );
    });

    it('should fail if invalid output for isolation mode wrapper', async () => {
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        core.marketIds.dArb,
        outputAmount,
        tokenWrapper,
        core
      );
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
        'GenericTraderProxyV2Lib: Invalid output for wrapper <1, 28>'
      );
    });

    it('should fail if wrapper is not trusted', async () => {
      const badTokenWrapper = await createContractWithAbi<TestIsolationModeWrapperTraderV2>(
        TestIsolationModeWrapperTraderV2__factory.abi,
        TestIsolationModeWrapperTraderV2__factory.bytecode,
        [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
      );
      const zapParams = await getWrapZapParams(
        otherMarketId1,
        amountWei,
        isolationModeMarketId,
        outputAmount,
        badTokenWrapper,
        core
      );
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
        `GenericTraderProxyV2Lib: Wrapper trader not enabled <${badTokenWrapper.address.toLowerCase()}, 52>`
      );
    });
  });

  describe('#_validateMakerAccountForTraderParam', () => {
    it('should fail with external liquidity if maker account index is not zero', async () => {
      await otherToken1.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      zapParams.tradersPath[0].makerAccountIndex = 1;
      await expectThrow(
        genericTraderProxy.swapExactInputForOutput({
          accountNumber: defaultAccountNumber,
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: MAX_UINT_256_BI,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          userConfig: zapParams.userConfig,
        }),
        'GenericTraderProxyV2Lib: Invalid maker account owner <0>'
      );
    });

    it('should fail with internal liquidity if maker account owner is address zero', async () => {
      const usdcAmount = BigNumber.from('100000000');
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await disableInterestAccrual(core, core.marketIds.usdc);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const zapParams = await getSimpleZapParams(core.marketIds.usdc, usdcAmount, core.marketIds.weth, ONE_BI, core);
      zapParams.tradersPath[0].trader = '0xb77a493a4950cad1b049e222d62bce14ff423c6f';
      zapParams.tradersPath[0].traderType = GenericTraderType.InternalLiquidity;
      zapParams.tradersPath[0].tradeData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [usdcAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [BigNumber.from('4321')])],
      );
      zapParams.makerAccounts.push({
        owner: ADDRESS_ZERO,
        number: defaultAccountNumber,
      });
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
        'GenericTraderProxyV2Lib: Invalid maker account owner <0>'
      );
    });

    it('should fail with internal liquidity if maker account index is invalid', async () => {
      const usdcAmount = BigNumber.from('100000000');
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await disableInterestAccrual(core, core.marketIds.usdc);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

      const zapParams = await getSimpleZapParams(core.marketIds.usdc, usdcAmount, core.marketIds.weth, ONE_BI, core);
      zapParams.tradersPath[0].trader = '0xb77a493a4950cad1b049e222d62bce14ff423c6f';
      zapParams.tradersPath[0].traderType = GenericTraderType.InternalLiquidity;
      zapParams.tradersPath[0].tradeData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [usdcAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [BigNumber.from('4321')])],
      );
      zapParams.tradersPath[0].makerAccountIndex = 4;
      zapParams.makerAccounts.push({
        owner: '0xb77a493a4950cad1b049e222d62bce14ff423c6f',
        number: defaultAccountNumber,
      });
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
        'GenericTraderProxyV2Lib: Invalid maker account owner <0>'
      );
    });
  });

  describe('#_validateTransferParams', () => {
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
        'GenericTraderProxyV2Lib: Invalid transfer amounts length'
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
        'GenericTraderProxyV2Lib: Cannot transfer to same account'
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
        'GenericTraderProxyV2Lib: Invalid trade account number'
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
        'GenericTraderProxyV2Lib: Invalid transfer amount at index <0>'
      );
    });
  });

  describe('isIsolationModeAsset', () => {
    it('should return true if market is isolation mode', async () => {
      expect(await genericTraderProxy.testIsIsolationModeAsset(isolationModeMarketId)).to.be.true;
      expect(await genericTraderProxy.testIsIsolationModeAsset(core.marketIds.dfsGlp)).to.be.true;
    });

    it('should return false if market is not isolation mode', async () => {
      expect(await genericTraderProxy.testIsIsolationModeAsset(otherMarketId1)).to.be.false;
      expect(await genericTraderProxy.testIsIsolationModeAsset(core.marketIds.weth)).to.be.false;
    });

    it('should return false if token reverts on name call', async () => {
      expect(await genericTraderProxy.testIsIsolationModeAssetWithAddress(core.dolomiteRegistry.address)).to.be.false;
    });
  });
});

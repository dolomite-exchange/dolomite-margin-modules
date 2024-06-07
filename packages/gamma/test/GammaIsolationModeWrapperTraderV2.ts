import { expect } from 'chai';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeTokenVaultV1__factory,
  GammaIsolationModeUnwrapperTraderV2,
  GammaIsolationModeVaultFactory,
  GammaPoolPriceOracle,
  GammaRegistry,
  IDeltaSwapPair,
  IDeltaSwapPair__factory,
  IERC20,
  IGammaPool,
  TestGammaIsolationModeWrapperTraderV2
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaPoolPriceOracle,
  createGammaRegistry,
  createGammaUnwrapperTraderV2,
  createTestGammaWrapperTraderV2
} from './gamma-ecosystem-utils';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { BalanceCheckFlag, address } from '@dolomite-exchange/dolomite-margin';
import { getCalldataForOdos } from 'packages/base/test/utils/trader-utils';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { createOdosAggregatorTrader } from 'packages/base/test/utils/ecosystem-utils/traders';
import { OdosAggregatorTrader, TestAggregatorTrader, TestAggregatorTrader__factory } from 'packages/base/src/types';
import { IERC20Metadata__factory } from 'packages/abracadabra/src/types';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const usdcAmount = BigNumber.from('1000000000'); // $1,000
const wethAmount = parseEther('.25');

describe('GammaIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaPool: IGammaPool;
  let deltaPair: IDeltaSwapPair;
  let gammaRegistry: GammaRegistry;
  let unwrapper: GammaIsolationModeUnwrapperTraderV2;
  let wrapper: TestGammaIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let vault: GammaIsolationModeTokenVaultV1;
  let gammaOracle: GammaPoolPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let marketId: BigNumber;
  let odosAggregator: OdosAggregatorTrader;
  let testAggregator: TestAggregatorTrader;

  before(async () => {
    core = await setupCoreProtocol({
      // blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      blockNumber: 219114000,
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    odosAggregator = await createOdosAggregatorTrader(core);
    testAggregator = await createContractWithAbi<TestAggregatorTrader>(
      TestAggregatorTrader__factory.abi,
      TestAggregatorTrader__factory.bytecode,
      [core.dolomiteMargin.address]
    );

    gammaRegistry = await createGammaRegistry(core);
    gammaPool = core.gammaEcosystem.gammaPools.wethUsdc;
    deltaPair = IDeltaSwapPair__factory.connect(await gammaPool.cfmm(), core.hhUser1);

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(gammaRegistry, gammaPool, vaultImplementation, core);

    unwrapper = await createGammaUnwrapperTraderV2(core, gammaFactory, gammaRegistry);
    wrapper = await createTestGammaWrapperTraderV2(core, gammaFactory, gammaRegistry);
    gammaOracle = await createGammaPoolPriceOracle(core, gammaRegistry);
    await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, gammaFactory, true, gammaOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<GammaIsolationModeTokenVaultV1>(
      await gammaFactory.getVaultByAccount(core.hhUser1.address),
      GammaIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(2), core.dolomiteMargin);

    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);

    await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(testAggregator.address, usdcAmount);
    await core.tokens.weth.connect(core.hhUser1).transfer(testAggregator.address, wethAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#exchange', () => {
    // use real latest block number with odos tests
    xit('should work normally for token0 with odos', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const params = await getOdosWrappingParams(
        core,
        borrowAccountNumber,
        wethAmount,
        core.tokens.weth,
        wethAmount.div(2),
        core.tokens.nativeUsdc,
        gammaFactory,
        ONE_BI,
        wrapper
      );
      await vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    xit('should work normally for token1 with odos', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const params = await getOdosWrappingParams(
        core,
        borrowAccountNumber,
        usdcAmount,
        core.tokens.nativeUsdc,
        usdcAmount.div(2),
        core.tokens.weth,
        gammaFactory,
        ONE_BI,
        wrapper
      );
      await vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 0 where swap amount is lower amount desired', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        wethAmount,
        core.tokens.weth,
        gammaFactory,
        BigNumber.from('100000000'), // $100
        ONE_BI
      );
      await expect(vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      )).to.emit(deltaPair, 'Swap').withNamedArgs({ amount1In: 0 });
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 0 where swap amount is higher amount desired', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        wethAmount,
        core.tokens.weth,
        gammaFactory,
        BigNumber.from('1000000000'), // $1,000
        ONE_BI
      );
      await expect(vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      )).to.emit(deltaPair, 'Swap').withNamedArgs({ amount0In: 0 });
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 1 where swap amount is lower amount desired', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        usdcAmount,
        core.tokens.nativeUsdc,
        gammaFactory,
        parseEther('0.1'),
        ONE_BI
      );
      await expect(vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      )).to.emit(deltaPair, 'Swap').withNamedArgs({ amount0In: 0 });
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 1 where swap amount is higher amount desired', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        usdcAmount,
        core.tokens.nativeUsdc,
        gammaFactory,
        parseEther('0.2'),
        ONE_BI
      );
      await expect(vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      )).to.emit(deltaPair, 'Swap').withNamedArgs({ amount1In: 0 });
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 0 and no dust', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        wethAmount,
        core.tokens.weth,
        gammaFactory,
        BigNumber.from('472206338'),
        ONE_BI
      );
      await vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });

    it('should work normally for token 1 and no dust', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const params = await getTestWrappingParams(
        core,
        borrowAccountNumber,
        usdcAmount,
        core.tokens.nativeUsdc,
        gammaFactory,
        parseEther('0.132357393266501044'),
        ONE_BI
      );
      await vault.swapExactInputForOutput(
        params.accountNumber,
        params.marketPath,
        params.inputAmount,
        params.minOutputAmount,
        params.traderParams,
        params.makerAccounts,
        params.userConfig
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: vault.address, number: borrowAccountNumber },
        marketId,
        ONE_BI,
        ZERO_BI
      );
    });
  });

  describe('#_doDeltaSwap', () => {
    it('should work normally for zero tokens', async () => {
      const res = await wrapper.connect(core.hhUser1).callStatic.testDoDeltaSwap(0, 0);
      expect(await core.tokens.weth.balanceOf(wrapper.address)).to.equal(res[0]);
      expect(await core.tokens.nativeUsdc.balanceOf(wrapper.address)).to.equal(res[1]);
    });

    it('should work normally for token0', async () => {
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.governance);
      await core.tokens.weth.transfer(wrapper.address, ONE_ETH_BI);

      const res = await wrapper.connect(core.hhUser1).callStatic.testDoDeltaSwap(0, 0);
      await wrapper.connect(core.hhUser1).testDoDeltaSwap(0, 0);

      expect(await core.tokens.weth.balanceOf(wrapper.address)).to.equal(res[0]);
      expect(await core.tokens.nativeUsdc.balanceOf(wrapper.address)).to.equal(res[1]);
    });

    it('should work normally for token1', async () => {
      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.governance);
      await core.tokens.nativeUsdc.transfer(wrapper.address, usdcAmount);

      const res = await wrapper.connect(core.hhUser1).callStatic.testDoDeltaSwap(0, 0);
      await wrapper.connect(core.hhUser1).testDoDeltaSwap(0, 0);

      expect(await core.tokens.weth.balanceOf(wrapper.address)).to.equal(res[0]);
      expect(await core.tokens.nativeUsdc.balanceOf(wrapper.address)).to.equal(res[1]);
    });
  });

  describe('#_retrieveDust', () => {
    it('should work with no dust', async () => {
      const token0Bal = await core.tokens.weth.balanceOf(core.governance.address);
      const token1Bal = await core.tokens.nativeUsdc.balanceOf(core.governance.address);
      await wrapper.testRetrieveDust();
      expect(await core.tokens.weth.balanceOf(core.governance.address)).to.equal(token0Bal);
      expect(await core.tokens.nativeUsdc.balanceOf(core.governance.address)).to.equal(token1Bal);
    });

    it('should work with token0 dust', async () => {
      const token0Bal = await core.tokens.weth.balanceOf(core.governance.address);
      const token1Bal = await core.tokens.nativeUsdc.balanceOf(core.governance.address);

      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.governance);
      await core.tokens.weth.transfer(wrapper.address, ONE_ETH_BI);
      await wrapper.testRetrieveDust();

      expect(await core.tokens.weth.balanceOf(core.governance.address)).to.equal(token0Bal.add(ONE_ETH_BI));
      expect(await core.tokens.nativeUsdc.balanceOf(core.governance.address)).to.equal(token1Bal);
    });

    it('should work with token1 dust', async () => {
      const token0Bal = await core.tokens.weth.balanceOf(core.governance.address);
      const token1Bal = await core.tokens.nativeUsdc.balanceOf(core.governance.address);

      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.governance);
      await core.tokens.nativeUsdc.transfer(wrapper.address, usdcAmount);
      await wrapper.testRetrieveDust();

      expect(await core.tokens.weth.balanceOf(core.governance.address)).to.equal(token0Bal);
      expect(await core.tokens.nativeUsdc.balanceOf(core.governance.address)).to.equal(token1Bal.add(usdcAmount));
    });

    it('should work with both dust', async () => {
      const token0Bal = await core.tokens.weth.balanceOf(core.governance.address);
      const token1Bal = await core.tokens.nativeUsdc.balanceOf(core.governance.address);

      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.governance);
      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.governance);
      await core.tokens.weth.transfer(wrapper.address, ONE_ETH_BI);
      await core.tokens.nativeUsdc.transfer(wrapper.address, usdcAmount);
      await wrapper.testRetrieveDust();

      expect(await core.tokens.weth.balanceOf(core.governance.address)).to.equal(token0Bal.add(ONE_ETH_BI));
      expect(await core.tokens.nativeUsdc.balanceOf(core.governance.address)).to.equal(token1Bal.add(usdcAmount));
    });
  });

  describe('#isValidInputToken', () => {
    it('should return true for either pool token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.weth.address)).to.equal(true);
      expect(await wrapper.isValidInputToken(core.tokens.nativeUsdc.address)).to.equal(true);
    });

    it('should return false for other tokens', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.dai.address)).to.equal(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.nativeUsdc.address, gammaFactory.address, ONE_ETH_BI, BYTES_EMPTY),
        'GammaWrapperTraderV2: getExchangeCost is not implemented',
      );
    });
  });

  async function getOdosWrappingParams(
    core: CoreProtocolArbitrumOne,
    accountNumber: BigNumberish,
    inputAmount: BigNumber,
    inputToken: IERC20,
    odosInputAmount: BigNumber,
    odosOutputToken: IERC20,
    outputToken: IERC20,
    minOutputAmount: BigNumber,
    receiver: { address: address},
  ): Promise<any> {
    const { calldata } = await getCalldataForOdos(
      odosInputAmount,
      inputToken,
      await IERC20Metadata__factory.connect(inputToken.address, core.hhUser1).decimals(),
      minOutputAmount,
      odosOutputToken,
      await IERC20Metadata__factory.connect(odosOutputToken.address, core.hhUser1).decimals(),
      receiver,
      core
    );
    const odosOrderData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        ONE_BI,
        calldata,
      ],
    );
    return {
      accountNumber,
      inputAmount,
      minOutputAmount,
      marketPath: [
        await core.dolomiteMargin.getMarketIdByTokenAddress(inputToken.address),
        await core.dolomiteMargin.getMarketIdByTokenAddress(outputToken.address)
      ],
      traderParams: [{
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: ethers.utils.defaultAbiCoder.encode(['address', 'bytes'], [odosAggregator.address, odosOrderData]),
        makerAccountIndex: 0
      }],
      makerAccounts: [],
      userConfig: {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      }
    };
  }

  async function getTestWrappingParams(
    core: CoreProtocolArbitrumOne,
    accountNumber: BigNumberish,
    inputAmount: BigNumber,
    inputToken: IERC20,
    outputToken: IERC20,
    minOutputAmountTrader: BigNumber,
    minOutputAmount: BigNumber,
  ): Promise<any> {
    const orderData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        minOutputAmountTrader,
        BYTES_EMPTY
      ],
    );
    return {
      accountNumber,
      inputAmount,
      minOutputAmount,
      marketPath: [
        await core.dolomiteMargin.getMarketIdByTokenAddress(inputToken.address),
        await core.dolomiteMargin.getMarketIdByTokenAddress(outputToken.address)
      ],
      traderParams: [{
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: ethers.utils.defaultAbiCoder.encode(['address', 'bytes'], [testAggregator.address, orderData]),
        makerAccountIndex: 0
      }],
      makerAccounts: [],
      userConfig: {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      }
    };
  }
});

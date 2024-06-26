import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
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
  GammaIsolationModeWrapperTraderV2,
  GammaRegistry,
  IGammaPool,
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaRegistry,
  createGammaUnwrapperTraderV2,
  createGammaWrapperTraderV2
} from './gamma-ecosystem-utils';
import {
  DolomiteZap,
  ApiMarket,
  ApiMarketConverter,
  IsolationType,
  Network as ZapNetwork,
  ApiToken,
  AggregatorType
} from '@dolomite-exchange/zap-sdk';
import { depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { setupDolomiteAccountRegistry } from 'packages/base/test/utils/dolomite';
import { BigNumber } from 'ethers';
import { toZapBigNumber } from 'packages/base/test/utils/liquidation-utils';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { createOdosAggregatorTrader } from 'packages/base/test/utils/ecosystem-utils/traders';
import { parseEther } from 'ethers/lib/utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan } from 'packages/base/test/utils/assertions';

const usdcAmount = BigNumber.from('1000000000'); // $1,000 USDC
const wethAmount = parseEther('.3');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('GammaZapIntegrationTests', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaPool: IGammaPool;
  let gammaRegistry: GammaRegistry;
  let marketId: BigNumber;
  let unwrapper: GammaIsolationModeUnwrapperTraderV2;
  let wrapper: GammaIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let gammaVault: GammaIsolationModeTokenVaultV1;
  let gammaApiToken: ApiToken;
  let nativeUsdcApiToken: ApiToken;
  let zap: DolomiteZap;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });
    const odosAggregator = await createOdosAggregatorTrader(core);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    gammaRegistry = await createGammaRegistry(core);
    gammaPool = core.gammaEcosystem.gammaPools.wethUsdc;

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(
      gammaRegistry,
      core.gammaEcosystem.gammaPools.wethUsdc,
      vaultImplementation,
      core
    );
    await setupDolomiteAccountRegistry(core, gammaFactory);

    unwrapper = await createGammaUnwrapperTraderV2(core, gammaFactory, gammaRegistry);
    wrapper = await createGammaWrapperTraderV2(core, gammaFactory, gammaRegistry);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gammaFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, gammaFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);
    gammaVault = setupUserVaultProxy<GammaIsolationModeTokenVaultV1>(
      await gammaFactory.getVaultByAccount(core.hhUser1.address),
      GammaIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    // Zap setup
    zap = new DolomiteZap({
      network: ZapNetwork.ARBITRUM_ONE,
      subgraphUrl: process.env.SUBGRAPH_URL as string,
      web3Provider: core.hhUser1.provider!
    });
    zap.setAggregator(AggregatorType.Odos, odosAggregator.address);

    gammaApiToken = {
      marketId: toZapBigNumber(marketId),
      symbol: 'gammaWETH/USDC',
      name: 'GAMMA WETH/USDC Market',
      decimals: 18,
      tokenAddress: gammaFactory.address
    };
    nativeUsdcApiToken = {
      marketId: toZapBigNumber(core.marketIds.nativeUsdc),
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
      tokenAddress: core.tokens.nativeUsdc.address
    };

    const GAMMA_MARKET_CONVERTER: ApiMarketConverter = {
      tokenAddress: gammaFactory.address,
      unwrapper: unwrapper.address,
      wrapper: wrapper.address,
      unwrapperMarketIds: [toZapBigNumber(core.marketIds.weth), toZapBigNumber(core.marketIds.nativeUsdc)],
      wrapperMarketIds: [toZapBigNumber(core.marketIds.weth), toZapBigNumber(core.marketIds.nativeUsdc)],
      unwrapperReadableName: 'Gamma WETH/USDC Isolation Mode Unwrapper',
      wrapperReadableName: 'Gamma WETH/USDC Isolation Mode Wrapper',
      isAsync: false
    };

    const GAMMA_MARKET: ApiMarket = {
      marketId: toZapBigNumber(marketId),
      symbol: 'gammaWETH/USDC',
      name: 'GAMMA WETH/USDC Market',
      tokenAddress: gammaFactory.address,
      decimals: 18,
      isolationModeUnwrapperInfo: {
        unwrapperAddress: unwrapper.address,
        outputMarketIds: [toZapBigNumber(core.marketIds.weth), toZapBigNumber(core.marketIds.nativeUsdc)],
        readableName: 'Gamma WETH/USDC Isolation Mode Unwrapper'
      },
      liquidityTokenUnwrapperInfo: undefined,
      isolationModeWrapperInfo: {
        wrapperAddress: wrapper.address,
        inputMarketIds: [toZapBigNumber(core.marketIds.weth), toZapBigNumber(core.marketIds.nativeUsdc)],
        readableName: 'Gamma WETH/USDC Isolation Mode Wrapper'
      },
      liquidityTokenWrapperInfo: undefined
    };

    const GAMMA_POOL = {
      // WETH - USDC pool
      poolAddress: core.gammaEcosystem.gammaPools.wethUsdc.address,
      token0Address: core.tokens.weth.address,
      token0MarketId: core.marketIds.weth,
      token1Address: core.tokens.nativeUsdc.address,
      token1MarketId: core.marketIds.nativeUsdc,
      cfmm: '0xB737586E9aB03c2Aa1e1a4f164DcEC2FE1dFbEb7',
    };
    zap.setMarketsToAdd([GAMMA_MARKET], [GAMMA_MARKET_CONVERTER], [IsolationType.Gamma], [GAMMA_POOL]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#unwrapping', () => {
    it('should work with token0', async () => {
      const amountWei = await depositGammaLPIntoDolomite(core, gammaVault, gammaPool);
      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        gammaApiToken,
        toZapBigNumber(amountWei),
        core.apiTokens.weth,
        toZapBigNumber(ONE_BI), // @follow-up Corey do you want to test with a different value here?
        unwrapper.address,
        { disallowAggregator: true }
      );

      // swapExactInputForOutput
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      const minAmountOut = zapOutputs[0].amountWeisPath[1].toFixed();
      await gammaVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapOutputs[0].marketIdsPath.map(marketId => marketId.toString()),
        amountWei,
        minAmountOut,
        zapOutputs[0].traderParams,
        zapOutputs[0].makerAccounts,
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gammaVault.address, number: borrowAccountNumber },
        core.marketIds.weth,
        minAmountOut,
        ZERO_BI
      );
    });

    it('should work with token1', async () => {
      const amountWei = await depositGammaLPIntoDolomite(core, gammaVault, gammaPool);
      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        gammaApiToken,
        toZapBigNumber(amountWei),
        nativeUsdcApiToken,
        toZapBigNumber(ONE_BI),
        unwrapper.address,
        { disallowAggregator: true }
      );

      // swapExactInputForOutput
      const minAmountOut = zapOutputs[0].amountWeisPath[1].toFixed();
      await gammaVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapOutputs[0].marketIdsPath.map(marketId => marketId.toString()),
        amountWei,
        minAmountOut,
        zapOutputs[0].traderParams,
        zapOutputs[0].makerAccounts,
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gammaVault.address, number: borrowAccountNumber },
        core.marketIds.nativeUsdc,
        minAmountOut,
        ZERO_BI
      );
    });
  });

  describe('#wrapping', () => {
    it('should work with token0', async () => {
      // deposit weth and transfer to vault
      await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);
      await gammaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );

      // get zap outputs
      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        core.apiTokens.weth,
        toZapBigNumber(wethAmount),
        gammaApiToken,
        toZapBigNumber(ONE_BI),
        wrapper.address,
        { disallowAggregator: true }
      );
      const minAmountOut = zapOutputs[0].amountWeisPath[1].toFixed();

      // swapExactInputForOutput
      await gammaVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapOutputs[0].marketIdsPath.map(marketId => marketId.toString()),
        wethAmount,
        minAmountOut,
        zapOutputs[0].traderParams,
        zapOutputs[0].makerAccounts,
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gammaVault.address, number: borrowAccountNumber },
        marketId,
        minAmountOut,
        ZERO_BI
      );
    });

    it('should work with token1', async () => {
      // deposit native usdc and transfer to vault
      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await gammaVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.Both
      );

      // get zap outputs
      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        nativeUsdcApiToken,
        toZapBigNumber(usdcAmount),
        gammaApiToken,
        toZapBigNumber(ONE_BI),
        wrapper.address,
        { disallowAggregator: true }
      );
      const minAmountOut = zapOutputs[0].amountWeisPath[1].toFixed();

      // swapExactInputForOutput
      await gammaVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapOutputs[0].marketIdsPath.map(marketId => marketId.toString()),
        usdcAmount,
        minAmountOut,
        zapOutputs[0].traderParams,
        zapOutputs[0].makerAccounts,
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, gammaVault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalanceIsGreaterThan(
        core,
        { owner: gammaVault.address, number: borrowAccountNumber },
        marketId,
        minAmountOut,
        ZERO_BI
      );
    });
  });
});

async function depositGammaLPIntoDolomite(
  core: CoreProtocolArbitrumOne,
  vault: GammaIsolationModeTokenVaultV1,
  gammaPool: IGammaPool,
): Promise<BigNumber> {
  await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.gammaEcosystem.positionManager);
  await setupWETHBalance(core, core.hhUser1, wethAmount, core.gammaEcosystem.positionManager);
  await core.gammaEcosystem.positionManager.connect(core.hhUser1).depositReserves({
    protocolId: await gammaPool.protocolId(),
    cfmm: await gammaPool.cfmm(),
    to: core.hhUser1.address,
    deadline: MAX_UINT_256_BI,
    amountsDesired: [wethAmount, usdcAmount],
    amountsMin: [0, 0],
  });
  const amountWei = await gammaPool.balanceOf(core.hhUser1.address);

  await gammaPool.connect(core.hhUser1).approve(vault.address, amountWei);
  await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
  await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

  return amountWei;
}

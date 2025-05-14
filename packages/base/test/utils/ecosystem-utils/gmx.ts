import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGLPIsolationModeVaultFactoryOld__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardsRouterV2,
  IGLPRewardsRouterV2__factory,
  IGMXIsolationModeVaultFactory,
  IGMXIsolationModeVaultFactory__factory,
  IGmxRegistryV1,
  IGmxRegistryV1__factory,
  IGmxRewardRouterV2,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester,
  IGmxVester__factory,
  ISGMX,
  ISGMX__factory,
} from '@dolomite-exchange/modules-glp/src/types';
import {
  GmxV2IsolationModeTokenVaultV1, GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeUnwrapperTraderV2__factory,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2IsolationModeWrapperTraderV2__factory,
  GmxV2MarketTokenPriceOracle,
  GmxV2MarketTokenPriceOracle__factory,
  GmxV2Registry,
  GmxV2Registry__factory,
  IGmxDataStore,
  IGmxDataStore__factory,
  IGmxDepositHandler,
  IGmxDepositHandler__factory,
  IGmxExchangeRouter,
  IGmxExchangeRouter__factory,
  IGmxMarketToken,
  IGmxMarketToken__factory,
  IGmxReader,
  IGmxReader__factory,
  IGmxRouter,
  IGmxRouter__factory,
  IGmxWithdrawalHandler,
  IGmxWithdrawalHandler__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumberish } from 'ethers';
import {
  IERC20,
  IERC20__factory,
  IERC20Mintable,
  IERC20Mintable__factory,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  AAVE_MAP,
  ARB_MAP,
  BN_GMX_MAP,
  DOGE_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP,
  ES_GMX_MAP,
  FS_GLP_MAP,
  GLP_MANAGER_MAP,
  GLP_MAP,
  GLP_REWARD_ROUTER_MAP,
  GMX_AAVE_USD_MARKET_TOKEN_MAP,
  GMX_ARB_USD_MARKET_TOKEN_MAP,
  BTC_PLACEHOLDER_MAP,
  GMX_BTC_SINGLE_SIDED_MARKET_TOKEN_MAP,
  GMX_BTC_USD_MARKET_TOKEN_MAP,
  GMX_DATASTORE_MAP,
  GMX_DEPOSIT_HANDLER_MAP,
  GMX_DEPOSIT_HANDLER_V2_MAP,
  GMX_DEPOSIT_VAULT_MAP,
  GMX_DOGE_USD_MARKET_TOKEN_MAP,
  GMX_ETH_SINGLE_SIDED_MARKET_TOKEN_MAP,
  GMX_ETH_USD_MARKET_TOKEN_MAP,
  GMX_EXCHANGE_ROUTER_MAP,
  GMX_EXECUTOR_MAP,
  GMX_GMX_SINGLE_SIDED_MARKET_TOKEN_MAP,
  GMX_GMX_USD_MARKET_TOKEN_MAP,
  GMX_LINK_USD_MARKET_TOKEN_MAP,
  GMX_MAP,
  GMX_PENDLE_USD_MARKET_TOKEN_MAP,
  GMX_PEPE_USD_MARKET_TOKEN_MAP,
  GMX_READER_MAP,
  GMX_REWARD_ROUTER_V2_MAP,
  GMX_REWARD_ROUTER_V3_MAP,
  GMX_REWARD_ROUTER_V4_MAP,
  GMX_ROUTER_MAP,
  GMX_SOL_USD_MARKET_TOKEN_MAP,
  GMX_UNI_USD_MARKET_TOKEN_MAP,
  GMX_VAULT_MAP,
  GMX_WIF_USD_MARKET_TOKEN_MAP,
  GMX_WITHDRAWAL_HANDLER_MAP,
  GMX_WITHDRAWAL_HANDLER_V2_MAP,
  GMX_WITHDRAWAL_VAULT_MAP,
  GMX_WST_ETH_USD_MARKET_TOKEN_MAP,
  LINK_MAP,
  NATIVE_USDC_MAP,
  PENDLE_MAP, PEPE_MAP,
  S_GLP_MAP,
  S_GMX_MAP,
  SBF_GMX_MAP,
  SOL_MAP,
  UNI_MAP,
  USDE_MAP,
  V_GLP_MAP,
  V_GMX_MAP,
  WBTC_MAP,
  WETH_MAP,
  WIF_MAP,
  WST_ETH_MAP,
  GMX_DOLO_USD_MARKET_TOKEN_MAP,
  GMXV2_TOKEN_ADDRESS_MAP,
  GMX_ETHENA_USD_MARKET_TOKEN_MAP,
  GMX_NEAR_USD_MARKET_TOKEN_MAP,
  GMX_TIA_USD_MARKET_TOKEN_MAP,
  GMX_ATOM_USD_MARKET_TOKEN_MAP,
  GMX_BERA_USD_MARKET_TOKEN_MAP,
  GMX_LIDO_USD_MARKET_TOKEN_MAP,
  GMX_LTC_USD_MARKET_TOKEN_MAP,
  GMX_MELANIA_USD_MARKET_TOKEN_MAP,
  GMX_MKR_USD_MARKET_TOKEN_MAP,
  GMX_POL_USD_MARKET_TOKEN_MAP,
  GMX_SEI_USD_MARKET_TOKEN_MAP,
  GMX_TRUMP_USD_MARKET_TOKEN_MAP,
  GMX_XRP_USD_MARKET_TOKEN_MAP,
  GMX_ZRO_USD_MARKET_TOKEN_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonateOrFallback } from '../index';
import { getContract, getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

export interface GmxEcosystem {
  bnGmx: IERC20;
  esGmx: IERC20Mintable;
  esGmxDistributorForStakedGlp: IEsGmxDistributor;
  esGmxDistributorForStakedGmx: IEsGmxDistributor;
  fsGlp: IERC20;
  glp: IERC20;
  glpManager: IGLPManager;
  glpRewardsRouter: IGLPRewardsRouterV2;
  gmx: IERC20;
  gmxRewardsRouterV2: IGmxRewardRouterV2;
  gmxRewardsRouterV3: IGmxRewardRouterV2;
  gmxRewardsRouterV4: IGmxRewardRouterV2;
  gmxVault: IGmxVault;
  sGlp: IERC20;
  sGmx: ISGMX;
  sbfGmx: IERC20;
  vGlp: IGmxVester;
  vGmx: IGmxVester;
  live: {
    dGlp: IGLPIsolationModeVaultFactoryOld;
    dGmx: IGMXIsolationModeVaultFactory;
    glpIsolationModeUnwrapperTraderV1: GLPIsolationModeUnwrapperTraderV1;
    glpIsolationModeWrapperTraderV1: GLPIsolationModeWrapperTraderV1;
    gmxRegistry: IGmxRegistryV1;
    gmxRegistryProxy: RegistryProxy;
  };
}

export interface GmToken {
  marketToken: IGmxMarketToken;
  indexToken: IERC20;
  longToken: IERC20;
  shortToken: IERC20;
  longMarketId: BigNumberish | -1;
  shortMarketId: BigNumberish;
}

export interface LiveGmMarket {
  factory: GmxV2IsolationModeVaultFactory;
  unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  unwrapperProxy: IsolationModeTraderProxy;
  wrapper: GmxV2IsolationModeWrapperTraderV2;
  wrapperProxy: IsolationModeTraderProxy;
}

function isLiveGmMarket(value: any) {
  return (
    'factory' in value &&
    'unwrapper' in value &&
    'unwrapperProxy' in value &&
    'wrapper' in value &&
    'wrapperProxy' in value
  );
}

export interface GmxV2Ecosystem {
  gmxDataStore: IGmxDataStore;
  gmxDepositHandler: IGmxDepositHandler;
  gmxDepositHandlerV2: IGmxDepositHandler;
  gmxDepositVault: { address: string };
  gmTokens: {
    aaveUsd: GmToken;
    arbUsd: GmToken;
    atomUsd: GmToken;
    beraUsd: GmToken;
    btc: GmToken;
    btcUsd: GmToken;
    dogeUsd: GmToken;
    doloUsd: GmToken;
    eth: GmToken;
    ethUsd: GmToken;
    ethenaUsd: GmToken;
    gmx: GmToken;
    gmxUsd: GmToken;
    lidoUsd: GmToken;
    linkUsd: GmToken;
    ltcUsd: GmToken;
    melaniaUsd: GmToken;
    mkrUsd: GmToken;
    nearUsd: GmToken;
    pendleUsd: GmToken;
    pepeUsd: GmToken;
    polUsd: GmToken;
    seiUsd: GmToken;
    solUsd: GmToken;
    tiaUsd: GmToken;
    trumpUsd: GmToken;
    uniUsd: GmToken;
    wifUsd: GmToken;
    wstEthUsd: GmToken;
    xrpUsd: GmToken;
    zroUsd: GmToken;
  };
  gmxEthUsdMarketToken: IGmxMarketToken;
  gmxExchangeRouter: IGmxExchangeRouter;
  gmxExecutor: SignerWithAddressWithSafety;
  gmxReader: IGmxReader;
  gmxRouter: IGmxRouter;
  gmxWithdrawalHandler: IGmxWithdrawalHandler;
  gmxWithdrawalHandlerV2: IGmxWithdrawalHandler;
  gmxWithdrawalVault: { address: string };
  live: {
    allGmMarkets: LiveGmMarket[];
    gmAaveUsd: LiveGmMarket;
    gmArbUsd: LiveGmMarket;
    gmBtc: LiveGmMarket;
    gmBtcUsd: LiveGmMarket;
    gmDogeUsd: LiveGmMarket;
    gmEth: LiveGmMarket;
    gmEthUsd: LiveGmMarket;
    gmGmx: LiveGmMarket;
    gmGmxUsd: LiveGmMarket;
    gmLinkUsd: LiveGmMarket;
    gmPendleUsd: LiveGmMarket;
    gmPepeUsd: LiveGmMarket;
    gmSolUsd: LiveGmMarket;
    gmUniUsd: LiveGmMarket;
    gmWifUsd: LiveGmMarket;
    gmWstEthUsd: LiveGmMarket;
    gmxV2LibraryMap: { GmxV2Library: string };
    registry: GmxV2Registry;
    registryProxy: RegistryProxy;
    tokenVaultImplementation: GmxV2IsolationModeTokenVaultV1;
    unwrapperImplementation: GmxV2IsolationModeUnwrapperTraderV2;
    wrapperImplementation: GmxV2IsolationModeWrapperTraderV2;
    priceOracle: GmxV2MarketTokenPriceOracle;
  };
}

export async function createGmxEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<GmxEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const esGmxDistributorAddressForGlp = ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP[network]!;
  const esGmxDistributorAddressForGmx = ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP[network]!;

  const esGmxDistributorForGlp = getContract(esGmxDistributorAddressForGlp, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGlp = await impersonateOrFallback(
    await esGmxDistributorForGlp.connect(signer).admin(),
    true,
    signer,
  );
  const esGmxDistributorForGmx = getContract(esGmxDistributorAddressForGmx, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGmx = await impersonateOrFallback(
    await esGmxDistributorForGmx.connect(signer).admin(),
    true,
    signer,
  );
  return {
    bnGmx: getContract(BN_GMX_MAP[network], IERC20__factory.connect, signer),
    esGmx: getContract(ES_GMX_MAP[network], IERC20Mintable__factory.connect, signer),
    esGmxDistributorForStakedGlp: esGmxDistributorForGlp.connect(esGmxAdminForGlp),
    esGmxDistributorForStakedGmx: esGmxDistributorForGmx.connect(esGmxAdminForGmx),
    fsGlp: getContract(FS_GLP_MAP[network], IERC20__factory.connect, signer),
    glp: getContract(GLP_MAP[network], IERC20__factory.connect, signer),
    glpManager: getContract(GLP_MANAGER_MAP[network], IGLPManager__factory.connect, signer),
    glpRewardsRouter: getContract(GLP_REWARD_ROUTER_MAP[network], IGLPRewardsRouterV2__factory.connect, signer),
    gmx: getContract(GMX_MAP[network]!.address, IERC20__factory.connect, signer),
    gmxRewardsRouterV2: getContract(GMX_REWARD_ROUTER_V2_MAP[network], IGmxRewardRouterV2__factory.connect, signer),
    gmxRewardsRouterV3: getContract(GMX_REWARD_ROUTER_V3_MAP[network], IGmxRewardRouterV2__factory.connect, signer),
    gmxRewardsRouterV4: getContract(GMX_REWARD_ROUTER_V4_MAP[network], IGmxRewardRouterV2__factory.connect, signer),
    gmxVault: getContract(GMX_VAULT_MAP[network], IGmxVault__factory.connect, signer),
    sGlp: getContract(S_GLP_MAP[network].address, IERC20__factory.connect, signer),
    sGmx: getContract(S_GMX_MAP[network], ISGMX__factory.connect, signer),
    sbfGmx: getContract(SBF_GMX_MAP[network], IERC20__factory.connect, signer),
    vGlp: getContract(V_GLP_MAP[network], IGmxVester__factory.connect, signer),
    vGmx: getContract(V_GMX_MAP[network], IGmxVester__factory.connect, signer),
    live: {
      dGlp: getContract(
        (Deployments.GLPIsolationModeVaultFactory as any)[network]?.address,
        IGLPIsolationModeVaultFactoryOld__factory.connect,
        signer,
      ),
      dGmx: getContract(
        (Deployments.GMXIsolationModeVaultFactory as any)[network]?.address,
        IGMXIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      glpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeUnwrapperTraderV1__factory.connect,
        signer,
      ),
      glpIsolationModeWrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeWrapperTraderV1__factory.connect,
        signer,
      ),
      gmxRegistry: getContract(
        (Deployments.GmxRegistryProxy as any)[network]?.address,
        IGmxRegistryV1__factory.connect,
        signer,
      ),
      gmxRegistryProxy: getContract(
        (Deployments.GmxRegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

export async function createGmxEcosystemV2(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<GmxV2Ecosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const gmxV2LibraryAddress = getMaxDeploymentVersionAddressByDeploymentKey('GmxV2Library', network);
  const priceOracleAddress = getMaxDeploymentVersionAddressByDeploymentKey('GmxV2MarketTokenPriceOracle', network);
  const tokenVaultImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GmxV2IsolationModeTokenVaultImplementation',
    network,
  );
  const unwrapperImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GmxV2IsolationModeUnwrapperTraderImplementation',
    network,
  );
  const wrapperImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GmxV2IsolationModeWrapperTraderImplementation',
    network,
  );

  const gmxV2Ecosystem: GmxV2Ecosystem = {
    gmxDepositHandler: getContract(GMX_DEPOSIT_HANDLER_MAP[network], IGmxDepositHandler__factory.connect, signer),
    gmxDepositHandlerV2: getContract(GMX_DEPOSIT_HANDLER_V2_MAP[network], IGmxDepositHandler__factory.connect, signer),
    gmxDepositVault: await impersonateOrFallback(GMX_DEPOSIT_VAULT_MAP[network], true, signer),
    gmTokens: {
      aaveUsd: {
        marketToken: getContract(GMX_AAVE_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(AAVE_MAP[network].address, signer),
        longToken: IERC20__factory.connect(AAVE_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: AAVE_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      arbUsd: {
        marketToken: getContract(GMX_ARB_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(ARB_MAP[network].address, signer),
        longToken: IERC20__factory.connect(ARB_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: ARB_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      atomUsd: {
        marketToken: getContract(GMX_ATOM_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['ATOM'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      beraUsd: {
        marketToken: getContract(GMX_BERA_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['BERA'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      btc: {
        marketToken: getContract(
          GMX_BTC_SINGLE_SIDED_MARKET_TOKEN_MAP[network],
          IGmxMarketToken__factory.connect,
          signer,
        ),
        indexToken: IERC20__factory.connect(BTC_PLACEHOLDER_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WBTC_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(WBTC_MAP[network].address, signer),
        longMarketId: WBTC_MAP[network].marketId,
        shortMarketId: WBTC_MAP[network].marketId,
      },
      btcUsd: {
        marketToken: getContract(GMX_BTC_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(BTC_PLACEHOLDER_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WBTC_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WBTC_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      dogeUsd: {
        marketToken: getContract(GMX_DOGE_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(DOGE_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      doloUsd: {
        marketToken: getContract(GMX_DOLO_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['DOLO'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      eth: {
        marketToken: getContract(
          GMX_ETH_SINGLE_SIDED_MARKET_TOKEN_MAP[network],
          IGmxMarketToken__factory.connect,
          signer,
        ),
        indexToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: WETH_MAP[network].marketId,
      },
      ethUsd: {
        marketToken: getContract(GMX_ETH_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      ethenaUsd: {
        marketToken: getContract(GMX_ETHENA_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['ENA'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      gmx: {
        marketToken: getContract(
          GMX_GMX_SINGLE_SIDED_MARKET_TOKEN_MAP[network],
          IGmxMarketToken__factory.connect,
          signer,
        ),
        indexToken: IERC20__factory.connect(GMX_MAP[network].address, signer),
        longToken: IERC20__factory.connect(GMX_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(GMX_MAP[network].address, signer),
        longMarketId: GMX_MAP[network].marketId,
        shortMarketId: GMX_MAP[network].marketId,
      },
      gmxUsd: {
        marketToken: getContract(GMX_GMX_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMX_MAP[network].address, signer),
        longToken: IERC20__factory.connect(GMX_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: GMX_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      lidoUsd: {
        marketToken: getContract(GMX_LIDO_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['LDO'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      linkUsd: {
        marketToken: getContract(GMX_LINK_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(LINK_MAP[network]!.address, signer),
        longToken: IERC20__factory.connect(LINK_MAP[network]!.address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: LINK_MAP[network]!.marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      ltcUsd: {
        marketToken: getContract(GMX_LTC_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['LTC'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      melaniaUsd: {
        marketToken: getContract(GMX_MELANIA_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['MELANIA'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      mkrUsd: {
        marketToken: getContract(GMX_MKR_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['MKR'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      nearUsd: {
        marketToken: getContract(GMX_NEAR_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['NEAR'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      pendleUsd: {
        marketToken: getContract(GMX_PENDLE_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(PENDLE_MAP[network]!.address, signer),
        longToken: IERC20__factory.connect(PENDLE_MAP[network]!.address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: PENDLE_MAP[network]!.marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      pepeUsd: {
        marketToken: getContract(GMX_PEPE_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(PEPE_MAP[network]!.address, signer),
        longToken: IERC20__factory.connect(PEPE_MAP[network]!.address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: PEPE_MAP[network]!.marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      polUsd: {
        marketToken: getContract(GMX_POL_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['POL'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      seiUsd: {
        marketToken: getContract(GMX_SEI_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['SEI'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      solUsd: {
        marketToken: getContract(GMX_SOL_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(SOL_MAP[network].address, signer),
        longToken: IERC20__factory.connect(SOL_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: SOL_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      tiaUsd: {
        marketToken: getContract(GMX_TIA_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['TIA'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      trumpUsd: {
        marketToken: getContract(GMX_TRUMP_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['TRUMP'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      uniUsd: {
        marketToken: getContract(GMX_UNI_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(UNI_MAP[network].address, signer),
        longToken: IERC20__factory.connect(UNI_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: UNI_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      wifUsd: {
        marketToken: getContract(GMX_WIF_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(WIF_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WIF_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WIF_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      wstEthUsd: {
        marketToken: getContract(GMX_WST_ETH_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        longToken: IERC20__factory.connect(WST_ETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(USDE_MAP[network].address, signer),
        longMarketId: WST_ETH_MAP[network].marketId,
        shortMarketId: USDE_MAP[network].marketId,
      },
      xrpUsd: {
        marketToken: getContract(GMX_XRP_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['XRP'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      zroUsd: {
        marketToken: getContract(GMX_ZRO_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
        indexToken: IERC20__factory.connect(GMXV2_TOKEN_ADDRESS_MAP[network]['ZRO'], signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      }
    },
    gmxEthUsdMarketToken: getContract(GMX_ETH_USD_MARKET_TOKEN_MAP[network], IGmxMarketToken__factory.connect, signer),
    gmxDataStore: getContract(GMX_DATASTORE_MAP[network], IGmxDataStore__factory.connect, signer),
    gmxExchangeRouter: getContract(GMX_EXCHANGE_ROUTER_MAP[network], IGmxExchangeRouter__factory.connect, signer),
    gmxExecutor: await impersonateOrFallback(GMX_EXECUTOR_MAP[network], true, signer),
    gmxReader: getContract(GMX_READER_MAP[network], IGmxReader__factory.connect, signer),
    gmxRouter: getContract(GMX_ROUTER_MAP[network], IGmxRouter__factory.connect, signer),
    gmxWithdrawalHandler: getContract(
      GMX_WITHDRAWAL_HANDLER_MAP[network],
      IGmxWithdrawalHandler__factory.connect,
      signer,
    ),
    gmxWithdrawalHandlerV2: getContract(
      GMX_WITHDRAWAL_HANDLER_V2_MAP[network],
      IGmxWithdrawalHandler__factory.connect,
      signer,
    ),
    gmxWithdrawalVault: { address: GMX_WITHDRAWAL_VAULT_MAP[network] },
    live: {
      allGmMarkets: [],
      gmAaveUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2AAVEIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2AAVEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2AAVEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2AAVEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2AAVEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmArbUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2ARBIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2ARBAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2ARBAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2ARBAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2ARBAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmBtc: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2SingleSidedBTCIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedBTCAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedBTCAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedBTCAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedBTCAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmBtcUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2BTCIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2BTCAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2BTCAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2BTCAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2BTCAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmDogeUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2DOGEIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2DOGEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2DOGEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2DOGEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2DOGEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmEth: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2SingleSidedETHIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmEthUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2ETHIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2ETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2ETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2ETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2ETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmGmx: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2SingleSidedGMXIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedGMXAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedGMXAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2SingleSidedGMXAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SingleSidedGMXAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmGmxUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2GMXIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2GMXAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2GMXAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2GMXAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2GMXAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmLinkUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2LINKIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2LINKAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2LINKAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2LINKAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2LINKAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmPendleUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2PENDLEIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2PENDLEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2PENDLEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2PENDLEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2PENDLEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmPepeUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2PEPEIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2PEPEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2PEPEAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2PEPEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2PEPEAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmSolUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2SOLIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2SOLAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SOLAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2SOLAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2SOLAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmUniUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2UNIIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2UNIAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2UNIAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2UNIAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2UNIAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmWifUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2WIFIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2WIFAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2WIFAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2WIFAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2WIFAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmWstEthUsd: {
        factory: GmxV2IsolationModeVaultFactory__factory.connect(
          Deployments.GmxV2WstETHIsolationModeVaultFactory['42161'].address,
          signer,
        ),
        unwrapper: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GmxV2WstETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2WstETHAsyncIsolationModeUnwrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapper: GmxV2IsolationModeWrapperTraderV2__factory.connect(
          Deployments.GmxV2WstETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GmxV2WstETHAsyncIsolationModeWrapperTraderProxyV2['42161'].address,
          signer,
        ),
      },
      gmxV2LibraryMap: { GmxV2Library: gmxV2LibraryAddress },
      priceOracle: GmxV2MarketTokenPriceOracle__factory.connect(priceOracleAddress, signer),
      registry: GmxV2Registry__factory.connect(Deployments.GmxV2RegistryProxy['42161'].address, signer),
      registryProxy: RegistryProxy__factory.connect(Deployments.GmxV2RegistryProxy['42161'].address, signer),
      tokenVaultImplementation: GmxV2IsolationModeTokenVaultV1__factory.connect(
        tokenVaultImplementationAddress,
        signer,
      ),
      unwrapperImplementation: GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
        unwrapperImplementationAddress,
        signer,
      ),
      wrapperImplementation: GmxV2IsolationModeWrapperTraderV2__factory.connect(wrapperImplementationAddress, signer),
    },
  };

  Object.keys(gmxV2Ecosystem.live).forEach((key) => {
    const liveAsAny = gmxV2Ecosystem.live as any;
    if (isLiveGmMarket(liveAsAny[key])) {
      gmxV2Ecosystem.live.allGmMarkets.push(liveAsAny[key]);
    }
  });

  return gmxV2Ecosystem;
}

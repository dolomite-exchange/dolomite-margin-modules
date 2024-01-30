import { ApiToken, BigNumber as ZapBigNumber } from '@dolomite-exchange/zap-sdk/dist';
import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as IGenericTraderProxyV1Json from '@dolomite-margin/deployed-contracts/GenericTraderProxyV1.json';
import * as LiquidatorAssetRegistryJson from '@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json';
import * as LiquidatorProxyV1Json from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json';
import * as LiquidatorProxyV1WithAmmJson from '@dolomite-margin/deployed-contracts/LiquidatorProxyV1WithAmm.json';
import * as LiquidatorProxyV2WithExternalLiquidityJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import * as LiquidatorProxyV3WithLiquidityTokenJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV3WithLiquidityToken.json';
import { address } from '@dolomite-margin/dist/src';
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface, Signer } from 'ethers';
import { ethers, network } from 'hardhat';
import { Network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP, NETWORK_TO_REGISTRY_PROXY_MAP, NetworkName } from '../../src/utils/no-deps-constants';
import Deployments, * as deployments from '../../../../scripts/deployments.json';
import {
  ARBIsolationModeVaultFactory__factory,
  ARBRegistry__factory,
  IARB,
  IARB__factory,
  IARBIsolationModeVaultFactory,
  IARBRegistry,
} from '@dolomite-exchange/modules-arb/src/types';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  IAlgebraV3Pool,
  IAlgebraV3Pool__factory,
  IBorrowPositionProxyV2,
  IBorrowPositionProxyV2__factory,
  IDepositWithdrawalProxy,
  IDepositWithdrawalProxy__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteInterestSetter,
  IDolomiteInterestSetter__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IDolomiteRegistry,
  IDolomiteRegistry__factory,
  IERC20,
  IERC20__factory,
  IERC20Mintable,
  IERC20Mintable__factory,
  IERC4626,
  IERC4626__factory,
  ILiquidatorAssetRegistry,
  ILiquidatorAssetRegistry__factory,
  ILiquidatorProxyV1,
  ILiquidatorProxyV1__factory,
  ILiquidatorProxyV1WithAmm,
  ILiquidatorProxyV1WithAmm__factory,
  ILiquidatorProxyV2WithExternalLiquidity,
  ILiquidatorProxyV2WithExternalLiquidity__factory,
  ILiquidatorProxyV3WithLiquidityToken,
  ILiquidatorProxyV3WithLiquidityToken__factory,
  ILiquidatorProxyV4WithGenericTrader,
  ILiquidatorProxyV4WithGenericTrader__factory,
  IEventEmitterRegistry,
  IEventEmitterRegistry__factory,
  IExpiry,
  IExpiry__factory,
  IGenericTraderProxyV1,
  IGenericTraderProxyV1__factory,
  IOdosRouter,
  IOdosRouter__factory,
  IParaswapAugustusRouter,
  IParaswapAugustusRouter__factory,
  IParaswapFeeClaimer,
  IParaswapFeeClaimer__factory,
  IPartiallyDelayedMultiSig,
  IPartiallyDelayedMultiSig__factory,
  IWETH,
  IWETH__factory,
  ParaswapAggregatorTrader,
  ParaswapAggregatorTrader__factory,
  RegistryProxy,
  RegistryProxy__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
  TestDolomiteMarginExchangeWrapper,
  TestDolomiteMarginExchangeWrapper__factory,
} from '../../src/types';
import {
  IPendleGLPRegistry,
  IPendleGLPRegistry__factory,
  IPendlePtMarket,
  IPendlePtMarket__factory,
  IPendlePtOracle,
  IPendlePtOracle__factory,
  IPendlePtToken,
  IPendlePtToken__factory,
  IPendleRegistry,
  IPendleRegistry__factory,
  IPendleRouter,
  IPendleRouter__factory,
  IPendleSyToken,
  IPendleSyToken__factory,
  IPendleYtToken,
  IPendleYtToken__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory__factory,
} from '@dolomite-exchange/modules-pendle/src/types';
import {
  IChainlinkPriceOracle,
  IChainlinkPriceOracle__factory,
  IChainlinkPriceOracleOld,
  IChainlinkPriceOracleOld__factory,
  IChainlinkRegistry,
  IChainlinkRegistry__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import {
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
  IGmxRegistryV1,
  IGmxRegistryV1__factory,
  IGmxRewardRouterV2,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester,
  IGmxVester__factory,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGLPIsolationModeVaultFactoryOld__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardsRouterV2,
  IGLPRewardsRouterV2__factory,
  IGMXIsolationModeVaultFactory,
  IGMXIsolationModeVaultFactory__factory,
  ISGMX,
  ISGMX__factory,
} from '@dolomite-exchange/modules-glp/src/types';
import {
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
import {
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPFarm__factory,
  IPlutusVaultGLPIsolationModeVaultFactory,
  IPlutusVaultGLPIsolationModeVaultFactory__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  IPlutusVaultRegistry,
  IPlutusVaultRegistry__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
} from '@dolomite-exchange/modules-plutus/src/types';
import {
  IJonesGLPAdapter,
  IJonesGLPAdapter__factory,
  IJonesGLPVaultRouter,
  IJonesGLPVaultRouter__factory,
  IJonesUSDCFarm,
  IJonesUSDCFarm__factory,
  IJonesUSDCRegistry,
  IJonesUSDCRegistry__factory,
  IJonesWhitelistController,
  IJonesWhitelistController__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
} from '@dolomite-exchange/modules-jones/src/types';
import {
  IUmamiAssetVault,
  IUmamiAssetVault__factory,
  IUmamiAssetVaultStorageViewer,
  IUmamiAssetVaultStorageViewer__factory,
} from '@dolomite-exchange/modules-umami/src/types';
import {
  VesterImplementationV1,
  VesterImplementationV1__factory,
  VesterProxy,
  VesterProxy__factory,
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import {
  TestInterestSetter,
  TestInterestSetter__factory,
} from '@dolomite-exchange/modules-interest-setters/src/types';
import {
  ARB_MAP,
  ATLAS_SI_TOKEN_MAP,
  BN_GMX_MAP,
  CHAINLINK_PRICE_ORACLE_MAP,
  CHAINLINK_PRICE_ORACLE_OLD_MAP,
  CHAINLINK_REGISTRY_MAP,
  D_ARB_MAP,
  D_GMX_MAP,
  DAI_MAP,
  DFS_GLP_MAP,
  DJ_USDC,
  DPLV_GLP_MAP,
  DPT_GLP_2024_MAP,
  DPT_R_ETH_JUN_2025_MAP,
  DPT_WST_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2025_MAP,
  DPX_MAP,
  DPX_WETH_V3_POOL_MAP,
  DYT_GLP_2024_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP,
  ES_GMX_MAP,
  FS_GLP_MAP,
  GLP_MANAGER_MAP,
  GLP_MAP,
  GLP_REWARD_ROUTER_MAP,
  GMX_DATASTORE_MAP,
  GMX_DEPOSIT_HANDLER_MAP,
  GMX_DEPOSIT_VAULT_MAP,
  GMX_ETH_USD_MARKET_TOKEN_MAP,
  GMX_EXCHANGE_ROUTER_MAP,
  GMX_EXECUTOR_MAP,
  GMX_MAP,
  GMX_READER_MAP,
  GMX_REWARD_ROUTER_V2_MAP,
  GMX_REWARD_ROUTER_V3_MAP,
  GMX_ROUTER_MAP,
  GMX_VAULT_MAP,
  GMX_WITHDRAWAL_HANDLER_MAP,
  GMX_WITHDRAWAL_VAULT_MAP,
  GRAIL_MAP,
  GRAIL_USDC_V3_POOL_MAP,
  GRAIL_WETH_V3_POOL_MAP,
  JONES_ECOSYSTEM_GOVERNOR_MAP,
  JONES_GLP_ADAPTER_MAP,
  JONES_GLP_VAULT_ROUTER_MAP,
  JONES_JUSDC_FARM_MAP,
  JONES_JUSDC_MAP,
  JONES_JUSDC_RECEIPT_TOKEN_MAP,
  JONES_MAP,
  JONES_WETH_V3_POOL_MAP,
  JONES_WHITELIST_CONTROLLER_MAP,
  LINK_MAP,
  MAGIC_GLP_MAP,
  MAGIC_MAP,
  MIM_MAP,
  NATIVE_USDC_MAP,
  ODOS_ROUTER_MAP,
  PARASWAP_AUGUSTUS_ROUTER_MAP,
  PARASWAP_FEE_CLAIMER_MAP,
  PARASWAP_TRANSFER_PROXY_MAP,
  PENDLE_MAP,
  PENDLE_PT_GLP_2024_MARKET_MAP,
  PENDLE_PT_GLP_2024_TOKEN_MAP,
  PENDLE_PT_ORACLE_MAP,
  PENDLE_PT_RETH_MARKET_MAP,
  PENDLE_PT_RETH_TOKEN_MAP,
  PENDLE_PT_WST_ETH_2024_MARKET_MAP,
  PENDLE_PT_WST_ETH_2024_TOKEN_MAP,
  PENDLE_PT_WST_ETH_2025_MARKET_MAP,
  PENDLE_PT_WST_ETH_2025_TOKEN_MAP,
  PENDLE_ROUTER_MAP,
  PENDLE_SY_GLP_TOKEN_MAP,
  PENDLE_SY_RETH_TOKEN_MAP,
  PENDLE_SY_WST_ETH_TOKEN_MAP,
  PENDLE_YT_GLP_2024_TOKEN_MAP,
  PLS_TOKEN_MAP,
  PLV_GLP_FARM_MAP,
  PLV_GLP_MAP,
  PLV_GLP_ROUTER_MAP,
  PREMIA_MAP,
  PREMIA_WETH_V3_POOL_MAP,
  RDNT_MAP,
  RETH_MAP,
  S_GLP_MAP,
  S_GMX_MAP,
  SBF_GMX_MAP,
  SIZE_MAP,
  SIZE_WETH_V3_POOL_MAP,
  ST_ETH_MAP,
  UMAMI_CONFIGURATOR_MAP,
  UMAMI_LINK_VAULT_MAP,
  UMAMI_STORAGE_VIEWER_MAP,
  UMAMI_UNI_VAULT_MAP,
  UMAMI_USDC_VAULT_MAP,
  UMAMI_WBTC_VAULT_MAP,
  UMAMI_WETH_VAULT_MAP,
  USDC_MAP,
  USDT_MAP,
  V_GLP_MAP,
  V_GMX_MAP,
  WBTC_MAP,
  WETH_MAP,
  WST_ETH_MAP,
} from '../../src/utils/constants';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { createDolomiteRegistryImplementation } from './dolomite';
import { impersonate, impersonateOrFallback, resetFork } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  blockNumber: number;
  network: Network;
}

export interface CoreProtocolConfig {
  blockNumber: number;
  network: Network;
  networkNumber: number;
}

export interface AbraEcosystem {
  magicGlp: IERC4626;
}

export interface ArbEcosystem {
  arb: IARB;
  live: {
    dArb: IARBIsolationModeVaultFactory;
    arbRegistry: IARBRegistry;
    arbRegistryProxy: RegistryProxy;
  };
}

export interface AtlasEcosystem {
  siToken: IERC20;
}

export interface CamelotEcosystem {
  dpxWethV3Pool: IAlgebraV3Pool;
  grailUsdcV3Pool: IAlgebraV3Pool;
  grailWethV3Pool: IAlgebraV3Pool;
  sizeWethV3Pool: IAlgebraV3Pool;
}

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
  gmxVault: IGmxVault;
  sGlp: IERC20;
  sGmx: ISGMX;
  sbfGmx: IERC20;
  vGlp: IGmxVester;
  vGmx: IGmxVester;
  live: {
    dGlp: IGLPIsolationModeVaultFactoryOld;
    dGmx: IGMXIsolationModeVaultFactory,
    glpIsolationModeUnwrapperTraderV1: GLPIsolationModeUnwrapperTraderV1;
    glpIsolationModeWrapperTraderV1: GLPIsolationModeWrapperTraderV1;
    gmxRegistry: IGmxRegistryV1;
    gmxRegistryProxy: RegistryProxy;
  };
}

export interface GmxEcosystemV2 {
  gmxDataStore: IGmxDataStore;
  gmxDepositHandler: IGmxDepositHandler;
  gmxDepositVault: SignerWithAddress;
  gmxEthUsdMarketToken: IGmxMarketToken;
  gmxExchangeRouter: IGmxExchangeRouter;
  gmxExecutor: SignerWithAddress;
  gmxReader: IGmxReader;
  gmxRouter: IGmxRouter;
  gmxWithdrawalHandler: IGmxWithdrawalHandler;
  gmxWithdrawalVault: SignerWithAddress;
}

export interface InterestSetters {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  linearStepFunction6L94UInterestSetter: IDolomiteInterestSetter;
  linearStepFunction8L92UInterestSetter: IDolomiteInterestSetter;
  linearStepFunction14L86UInterestSetter: IDolomiteInterestSetter;
}

export interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistController: IJonesWhitelistController;
  usdcReceiptToken: IERC4626;
  jUSDC: IERC4626;
  jUSDCFarm: IJonesUSDCFarm;
  admin: SignerWithAddress;
  jonesWethV3Pool: IAlgebraV3Pool;
  live: {
    jUSDCIsolationModeFactory: JonesUSDCIsolationModeVaultFactory;
    jonesUSDCRegistry: IJonesUSDCRegistry;
    jonesUSDCRegistryProxy: RegistryProxy;
  };
}

export interface LiquidityMiningEcosystem {
  oArbVester: VesterImplementationV1;
  oArbVesterProxy: VesterProxy;
}

export interface OdosEcosystem {
  odosRouter: IOdosRouter;
}

export interface ParaswapEcosystem {
  augustusRouter: IParaswapAugustusRouter;
  feeClaimer: IParaswapFeeClaimer;
  transferProxy: address;
}

export interface PendleEcosystem {
  pendleRouter: IPendleRouter;
  glpMar2024: {
    pendleRegistry: IPendleGLPRegistry;
    pendleRegistryProxy: RegistryProxy;
    ptGlpMarket: IPendlePtMarket;
    ptGlpToken: IPendlePtToken;
    ptOracle: IPendlePtOracle;
    ytGlpToken: IPendleYtToken;
    dPtGlp2024: PendlePtGLP2024IsolationModeVaultFactory;
    dYtGlp2024: PendleYtGLP2024IsolationModeVaultFactory;
  };
  rEthJun2025: {
    dPtREthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptREthMarket: IPendlePtMarket;
    ptREthToken: IPendlePtToken;
  };
  wstEthJun2024: {
    dPtWstEthJun2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  wstEthJun2025: {
    dPtWstEthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  syGlpToken: IPendleSyToken;
  syREthToken: IPendleSyToken;
  syWstEthToken: IPendleSyToken;
}

export interface PlutusEcosystem {
  plvGlp: IERC4626;
  plsToken: IERC20;
  plvGlpFarm: IPlutusVaultGLPFarm;
  plvGlpRouter: IPlutusVaultGLPRouter;
  sGlp: IERC20;
  live: {
    dolomiteWhitelistForGlpDepositor: DolomiteCompatibleWhitelistForPlutusDAO;
    dolomiteWhitelistForPlutusChef: DolomiteCompatibleWhitelistForPlutusDAO;
    plutusVaultRegistry: IPlutusVaultRegistry;
    plvGlpIsolationModeFactory: IPlutusVaultGLPIsolationModeVaultFactory;
    plvGlpIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
    plvGlpIsolationModeWrapperTraderV1: PlutusVaultGLPIsolationModeWrapperTraderV1;
  };
}

export interface PremiaEcosystem {
  premiaWethV3Pool: IAlgebraV3Pool;
}

export interface TestEcosystem {
  testExchangeWrapper: TestDolomiteMarginExchangeWrapper;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
}

export interface UmamiEcosystem {
  glpLink: IUmamiAssetVault;
  glpUni: IUmamiAssetVault;
  glpUsdc: IUmamiAssetVault;
  glpWbtc: IUmamiAssetVault;
  glpWeth: IUmamiAssetVault;
  storageViewer: IUmamiAssetVaultStorageViewer;
  configurator: Signer;
}

export interface CoreProtocol {
  /// =========================
  /// Config and Signers
  /// =========================
  /**
   * Config passed through at Core Protocol's creation time
   */
  config: CoreProtocolConfig;
  governance: SignerWithAddress;
  hhUser1: SignerWithAddress;
  hhUser2: SignerWithAddress;
  hhUser3: SignerWithAddress;
  hhUser4: SignerWithAddress;
  hhUser5: SignerWithAddress;
  /// =========================
  /// Contracts and Ecosystems
  /// =========================
  abraEcosystem: AbraEcosystem | undefined;
  arbEcosystem: ArbEcosystem | undefined;
  atlasEcosystem: AtlasEcosystem | undefined;
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  camelotEcosystem: CamelotEcosystem | undefined;
  chainlinkPriceOracleOld: IChainlinkPriceOracleOld | undefined;
  chainlinkPriceOracle: IChainlinkPriceOracle | undefined;
  chainlinkRegistry: IChainlinkRegistry | undefined;
  delayedMultiSig: IPartiallyDelayedMultiSig;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteAmmFactory: IDolomiteAmmFactory;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  eventEmitterRegistry: IEventEmitterRegistry | undefined;
  eventEmitterRegistryProxy: RegistryProxy | undefined;
  expiry: IExpiry;
  genericTraderProxy: IGenericTraderProxyV1 | undefined;
  gmxEcosystem: GmxEcosystem | undefined;
  gmxEcosystemV2: GmxEcosystemV2 | undefined;
  interestSetters: InterestSetters;
  jonesEcosystem: JonesEcosystem | undefined;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV1WithAmm: ILiquidatorProxyV1WithAmm;
  liquidatorProxyV2: ILiquidatorProxyV2WithExternalLiquidity | undefined;
  liquidatorProxyV3: ILiquidatorProxyV3WithLiquidityToken | undefined;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  liquidityMiningEcosystem: LiquidityMiningEcosystem | undefined;
  odosEcosystem: OdosEcosystem | undefined;
  paraswapEcosystem: ParaswapEcosystem | undefined;
  paraswapTrader: ParaswapAggregatorTrader | undefined;
  pendleEcosystem: PendleEcosystem | undefined;
  plutusEcosystem: PlutusEcosystem | undefined;
  premiaEcosystem: PremiaEcosystem | undefined;
  testEcosystem: TestEcosystem | undefined;
  tokenVaultActionsLibraries: Record<string, string> | undefined;
  umamiEcosystem: UmamiEcosystem | undefined;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  marketIds: {
    arb: BigNumberish | undefined;
    dai: BigNumberish | undefined;
    dArb: BigNumberish | undefined;
    dfsGlp: BigNumberish | undefined;
    dGmx: BigNumberish | undefined;
    djUSDC: BigNumberish | undefined;
    dplvGlp: BigNumberish | undefined;
    dPtGlp: BigNumberish | undefined;
    dPtREthJun2025: BigNumberish | undefined;
    dPtWstEthJun2024: BigNumberish | undefined;
    dPtWstEthJun2025: BigNumberish | undefined;
    dpx: BigNumberish | undefined;
    dYtGlp: BigNumberish | undefined;
    gmx: BigNumberish | undefined;
    grail: BigNumberish | undefined;
    jones: BigNumberish | undefined;
    link: BigNumberish;
    magic: BigNumberish | undefined;
    magicGlp: BigNumberish | undefined;
    mim: BigNumberish | undefined;
    nativeUsdc: BigNumberish | undefined;
    premia: BigNumberish | undefined;
    rEth: BigNumberish | undefined;
    radiant: BigNumberish | undefined;
    pendle: BigNumberish | undefined;
    usdc: BigNumberish;
    usdt: BigNumberish | undefined;
    wbtc: BigNumberish;
    weth: BigNumberish;
    wstEth: BigNumberish | undefined;
  };
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  tokens: {
    arb: IERC20 | undefined;
    dai: IERC20;
    dArb: IERC20 | undefined;
    dfsGlp: IERC20 | undefined;
    dGmx: IERC20 | undefined;
    dPtGlp: IERC20 | undefined;
    dPtREthJun2025: IERC20 | undefined;
    dPtWstEthJun2024: IERC20 | undefined;
    dPtWstEthJun2025: IERC20 | undefined;
    dpx: IERC20 | undefined;
    dYtGlp: IERC20 | undefined;
    gmx: IERC20 | undefined;
    grail: IERC20 | undefined;
    jones: IERC20 | undefined;
    link: IERC20;
    magic: IERC20 | undefined;
    nativeUsdc: IERC20 | undefined;
    premia: IERC20 | undefined;
    rEth: IERC20 | undefined;
    radiant: IERC20 | undefined;
    pendle: IERC20 | undefined;
    size: IERC20 | undefined;
    stEth: IERC20 | undefined;
    usdc: IERC20;
    wbtc: IERC20;
    weth: IWETH;
    wstEth: IERC20 | undefined;
  };
}

export async function disableInterestAccrual(core: CoreProtocol, marketId: BigNumberish) {
  return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.interestSetters.alwaysZeroInterestSetter.address);
}

export async function enableInterestAccrual(core: CoreProtocol, marketId: BigNumberish) {
  return core.dolomiteMargin.ownerSetInterestSetter(
    marketId,
    core.interestSetters.linearStepFunction8L92UInterestSetter.address,
  );
}

export async function setupWETHBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  await core.tokens.weth.connect(signer).deposit({ value: amount });
  await core.tokens.weth.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupARBBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xf3fc178157fb3c87548baa86f9d24ba38e649b58'; // ARB Treasury
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.arb!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.arb!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupDAIBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x489ee077994b6658eafa855c308275ead8097c4a'; // GMX Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.dai.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.dai.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupNativeUSDCBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x3dd1d15b3c78d6acfd75a254e857cbe5b9ff0af2'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.nativeUsdc!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.nativeUsdc!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.usdc.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupGMBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender?: { address: string },
) {
  const controller = await impersonate(core.gmxEcosystemV2!.gmxExchangeRouter.address, true);
  await core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(controller).mint(signer.address, amount);
  if (spender) {
    await core.gmxEcosystemV2!.gmxEthUsdMarketToken.connect(signer).approve(spender.address, amount);
  }
}

export async function setupGMXBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.gmx!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.gmx!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupRETHBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.rEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.rEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupWstETHBalance(
  core: CoreProtocol,
  signer: SignerWithAddress,
  amount: BigNumberish,
  spender: { address: string },
) {
  const whaleAddress = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer Vault
  const whaleSigner = await impersonate(whaleAddress, true);
  await core.tokens.wstEth!.connect(whaleSigner).transfer(signer.address, amount);
  await core.tokens.wstEth!.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export function setupUserVaultProxy<T extends BaseContract>(
  vault: address,
  factoryInterface: { abi: ContractInterface },
  signer?: SignerWithAddress,
): T {
  return new BaseContract(
    vault,
    factoryInterface.abi,
    signer,
  ) as T;
}

export function getDefaultCoreProtocolConfig(network: Network): CoreProtocolConfig {
  return {
    network,
    blockNumber: NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network],
    networkNumber: parseInt(network, 10),
  };
}

export function getDefaultCoreProtocolConfigForGmxV2(): CoreProtocolConfig {
  return {
    network: Network.ArbitrumOne,
    networkNumber: parseInt(Network.ArbitrumOne, 10),
    blockNumber: 164_788_000,
  };
}

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber, config.network);
  } else {
    console.log('\tSkipping forking...');
  }

  const DOLOMITE_MARGIN = new BaseContract(
    DolomiteMarginJson.networks[config.network].address,
    IDolomiteMargin__factory.createInterface(),
  ) as IDolomiteMargin;

  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const governance: SignerWithAddress = await impersonateOrFallback(
    await DOLOMITE_MARGIN.connect(hhUser1).owner(),
    true,
    hhUser1,
  );

  const borrowPositionProxyV2 = IBorrowPositionProxyV2__factory.connect(
    BorrowPositionProxyV2Json.networks[config.network].address,
    governance,
  );

  const chainlinkPriceOracleOld = getContractOpt(
    CHAINLINK_PRICE_ORACLE_OLD_MAP[config.network],
    IChainlinkPriceOracleOld__factory.connect,
    governance,
  );

  const chainlinkPriceOracle = getContractOpt(
    CHAINLINK_PRICE_ORACLE_MAP[config.network],
    IChainlinkPriceOracle__factory.connect,
    governance,
  );

  const chainlinkRegistry = getContractOpt(
    CHAINLINK_REGISTRY_MAP[config.network],
    IChainlinkRegistry__factory.connect,
    governance,
  );

  const delayedMultiSig = IPartiallyDelayedMultiSig__factory.connect(
    await DOLOMITE_MARGIN.connect(hhUser1).owner(),
    governance,
  );

  const depositWithdrawalProxy = IDepositWithdrawalProxy__factory.connect(
    DepositWithdrawalProxyJson.networks[config.network].address,
    governance,
  );

  const dolomiteAmmFactory = IDolomiteAmmFactory__factory.connect(
    DolomiteAmmFactoryJson.networks[config.network].address,
    governance,
  );

  const dolomiteAmmRouterProxy = IDolomiteAmmRouterProxy__factory.connect(
    DolomiteAmmRouterProxyJson.networks[config.network].address,
    governance,
  );

  const dolomiteMargin = DOLOMITE_MARGIN.connect(governance);

  let dolomiteRegistry: IDolomiteRegistry;
  let dolomiteRegistryProxy: RegistryProxy;
  if (
    config.blockNumber >= NETWORK_TO_REGISTRY_PROXY_MAP[config.network]
    || network.name === NetworkName.ArbitrumOne
  ) {
    dolomiteRegistry = IDolomiteRegistry__factory.connect(
      (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
      governance,
    );
    dolomiteRegistryProxy = RegistryProxy__factory.connect(
      (Deployments.DolomiteRegistryProxy as any)[config.network]?.address,
      governance,
    );
  } else {
    // Use a "dummy" implementation
    const implementation = await createDolomiteRegistryImplementation();
    dolomiteRegistry = IDolomiteRegistry__factory.connect(implementation.address, hhUser1);
    dolomiteRegistryProxy = null as any;
  }

  const eventEmitterRegistry = getContractOpt(
    (Deployments.EventEmitterRegistryProxy as any)[config.network].address,
    IEventEmitterRegistry__factory.connect,
    governance,
  );

  const eventEmitterRegistryProxy = getContractOpt(
    (Deployments.EventEmitterRegistryProxy as any)[config.network].address,
    RegistryProxy__factory.connect,
    governance,
  );

  const expiry = IExpiry__factory.connect(
    ExpiryJson.networks[config.network].address,
    governance,
  );

  const genericTraderProxy = getContractOpt(
    (IGenericTraderProxyV1Json.networks as any)[config.network]?.address,
    IGenericTraderProxyV1__factory.connect,
    governance,
  );

  const liquidatorAssetRegistry = ILiquidatorAssetRegistry__factory.connect(
    LiquidatorAssetRegistryJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1 = ILiquidatorProxyV1__factory.connect(
    LiquidatorProxyV1Json.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV1WithAmm = ILiquidatorProxyV1WithAmm__factory.connect(
    LiquidatorProxyV1WithAmmJson.networks[config.network].address,
    governance,
  );

  const liquidatorProxyV2 = getContractOpt(
    (LiquidatorProxyV2WithExternalLiquidityJson.networks as any)[config.network]?.address,
    ILiquidatorProxyV2WithExternalLiquidity__factory.connect,
    governance,
  );

  const liquidatorProxyV3 = getContractOpt(
    (LiquidatorProxyV3WithLiquidityTokenJson.networks as any)[config.network]?.address,
    ILiquidatorProxyV3WithLiquidityToken__factory.connect,
    governance,
  );

  const liquidatorProxyV4 = getContract(
    // LiquidatorProxyV4WithGenericTraderJson.networks[config.network].address,
    '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3',
    ILiquidatorProxyV4WithGenericTrader__factory.connect,
    governance,
  );

  const paraswapTrader = getContractOpt(
    (Deployments.ParaswapAggregatorTrader as any)[config.network]?.address,
    ParaswapAggregatorTrader__factory.connect,
    governance,
  );

  const abraEcosystem = await createAbraEcosystem(config.network, hhUser1);
  const arbEcosystem = await createArbEcosystem(config.network, hhUser1);
  const atlasEcosystem = await createAtlasEcosystem(config.network, hhUser1);
  const camelotEcosystem = await createCamelotEcosystem(config.network, hhUser1);
  const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);
  const gmxEcosystemV2 = await createGmxEcosystemV2(config.network, hhUser1);
  const interestSetters = await createInterestSetters(config.network, hhUser1);
  const jonesEcosystem = await createJonesEcosystem(config.network, hhUser1);
  const liquidityMiningEcosystem = await createLiquidityMiningEcosystem(config.network, hhUser1);
  const odosEcosystem = await createOdosEcosystem(config.network, hhUser1);
  const paraswapEcosystem = await createParaswapEcosystem(config.network, hhUser1);
  const pendleEcosystem = await createPendleEcosystem(config.network, hhUser1);
  const plutusEcosystem = await createPlutusEcosystem(config.network, hhUser1);
  const premiaEcosystem = await createPremiaEcosystem(config.network, hhUser1);
  const testEcosystem = await createTestEcosystem(dolomiteMargin, dolomiteRegistry, governance, hhUser1, config);
  const tokenVaultActionsLibraries = await createTokenVaultActionsLibraries(config);
  const umamiEcosystem = await createUmamiEcosystem(config.network, hhUser1);

  return {
    abraEcosystem,
    arbEcosystem,
    atlasEcosystem,
    borrowPositionProxyV2,
    camelotEcosystem,
    chainlinkRegistry,
    chainlinkPriceOracleOld,
    chainlinkPriceOracle,
    delayedMultiSig,
    depositWithdrawalProxy,
    dolomiteAmmFactory,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    dolomiteRegistry,
    dolomiteRegistryProxy,
    eventEmitterRegistry,
    eventEmitterRegistryProxy,
    expiry,
    genericTraderProxy,
    gmxEcosystem,
    gmxEcosystemV2,
    governance,
    interestSetters,
    jonesEcosystem,
    liquidatorAssetRegistry,
    liquidatorProxyV1,
    liquidatorProxyV1WithAmm,
    liquidatorProxyV2,
    liquidatorProxyV3,
    liquidatorProxyV4,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    liquidityMiningEcosystem,
    odosEcosystem,
    paraswapEcosystem,
    paraswapTrader,
    pendleEcosystem,
    plutusEcosystem,
    premiaEcosystem,
    testEcosystem,
    tokenVaultActionsLibraries,
    umamiEcosystem,
    config: {
      blockNumber: config.blockNumber,
      network: config.network,
      networkNumber: parseInt(config.network, 10),
    },
    apiTokens: {
      usdc: {
        marketId: new ZapBigNumber(USDC_MAP[config.network].marketId),
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        tokenAddress: USDC_MAP[config.network].address,
      },
      weth: {
        marketId: new ZapBigNumber(WETH_MAP[config.network].marketId),
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        tokenAddress: WETH_MAP[config.network].address,
      },
    },
    marketIds: {
      arb: ARB_MAP[config.network]?.marketId,
      dai: DAI_MAP[config.network]?.marketId,
      dArb: D_ARB_MAP[config.network]?.marketId,
      dfsGlp: DFS_GLP_MAP[config.network]?.marketId,
      dGmx: D_GMX_MAP[config.network]?.marketId,
      djUSDC: DJ_USDC[config.network]?.marketId,
      dplvGlp: DPLV_GLP_MAP[config.network]?.marketId,
      dPtGlp: DPT_GLP_2024_MAP[config.network]?.marketId,
      dPtREthJun2025: DPT_R_ETH_JUN_2025_MAP[config.network]?.marketId,
      dPtWstEthJun2024: DPT_WST_ETH_JUN_2024_MAP[config.network]?.marketId,
      dPtWstEthJun2025: DPT_WST_ETH_JUN_2025_MAP[config.network]?.marketId,
      dpx: DPX_MAP[config.network]?.marketId,
      dYtGlp: DYT_GLP_2024_MAP[config.network]?.marketId,
      gmx: GMX_MAP[config.network]?.marketId,
      grail: GRAIL_MAP[config.network]?.marketId,
      jones: JONES_MAP[config.network]?.marketId,
      link: LINK_MAP[config.network].marketId,
      magic: MAGIC_MAP[config.network]?.marketId,
      magicGlp: MAGIC_GLP_MAP[config.network]?.marketId,
      mim: MIM_MAP[config.network]?.marketId,
      nativeUsdc: NATIVE_USDC_MAP[config.network]?.marketId,
      premia: PREMIA_MAP[config.network]?.marketId,
      rEth: RETH_MAP[config.network]?.marketId,
      radiant: RDNT_MAP[config.network]?.marketId,
      pendle: PENDLE_MAP[config.network]?.marketId,
      usdc: USDC_MAP[config.network].marketId,
      usdt: USDT_MAP[config.network]?.marketId,
      wbtc: WBTC_MAP[config.network].marketId,
      weth: WETH_MAP[config.network].marketId,
      wstEth: WST_ETH_MAP[config.network]?.marketId,
    },
    tokens: {
      arb: createIERC20Opt(ARB_MAP[config.network]?.address, hhUser1),
      dai: IERC20__factory.connect(DAI_MAP[config.network].address, hhUser1),
      dArb: createIERC20Opt(D_ARB_MAP[config.network]?.address, hhUser1),
      dfsGlp: createIERC20Opt(DFS_GLP_MAP[config.network]?.address, hhUser1),
      dGmx: createIERC20Opt(D_GMX_MAP[config.network]?.address, hhUser1),
      dPtGlp: createIERC20Opt(DPT_GLP_2024_MAP[config.network]?.address, hhUser1),
      dPtREthJun2025: createIERC20Opt(DPT_R_ETH_JUN_2025_MAP[config.network]?.address, hhUser1),
      dPtWstEthJun2024: createIERC20Opt(DPT_WST_ETH_JUN_2024_MAP[config.network]?.address, hhUser1),
      dPtWstEthJun2025: createIERC20Opt(DPT_WST_ETH_JUN_2025_MAP[config.network]?.address, hhUser1),
      dpx: createIERC20Opt(DPX_MAP[config.network]?.address, hhUser1),
      dYtGlp: createIERC20Opt(DYT_GLP_2024_MAP[config.network]?.address, hhUser1),
      gmx: createIERC20Opt(GMX_MAP[config.network]?.address, hhUser1),
      grail: createIERC20Opt(GRAIL_MAP[config.network]?.address, hhUser1),
      jones: createIERC20Opt(JONES_MAP[config.network]?.address, hhUser1),
      link: IERC20__factory.connect(LINK_MAP[config.network].address, hhUser1),
      magic: createIERC20Opt(MAGIC_MAP[config.network]?.address, hhUser1),
      nativeUsdc: createIERC20Opt(NATIVE_USDC_MAP[config.network]?.address, hhUser1),
      premia: createIERC20Opt(PREMIA_MAP[config.network]?.address, hhUser1),
      pendle: createIERC20Opt(PENDLE_MAP[config.network]?.address, hhUser1),
      rEth: createIERC20Opt(RETH_MAP[config.network]?.address, hhUser1),
      radiant: createIERC20Opt(RDNT_MAP[config.network]?.address, hhUser1),
      size: createIERC20Opt(SIZE_MAP[config.network]?.address, hhUser1),
      stEth: createIERC20Opt(ST_ETH_MAP[config.network]?.address, hhUser1),
      usdc: IERC20__factory.connect(USDC_MAP[config.network].address, hhUser1),
      wbtc: IERC20__factory.connect(WBTC_MAP[config.network].address, hhUser1),
      weth: IWETH__factory.connect(WETH_MAP[config.network].address, hhUser1),
      wstEth: createIERC20Opt(WST_ETH_MAP[config.network]?.address, hhUser1),
    },
  };
}

function createIERC20Opt(address: string | undefined, signerOrProvider: SignerWithAddress): IERC20 | undefined {
  if (!address) {
    return undefined;
  }

  return IERC20__factory.connect(address, signerOrProvider);
}

export async function setupTestMarket(
  core: CoreProtocol,
  token: { address: address },
  isClosing: boolean,
  priceOracle?: { address: address },
  marginPremium?: BigNumberish,
  spreadPremium?: BigNumberish,
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    (priceOracle ?? core.testEcosystem!.testPriceOracle).address,
    core.testEcosystem!.testInterestSetter.address,
    { value: marginPremium ?? 0 },
    { value: spreadPremium ?? 0 },
    0,
    isClosing,
    false,
  );
}

async function createTestEcosystem(
  dolomiteMargin: IDolomiteMargin,
  dolomiteRegistry: IDolomiteRegistry,
  governor: SignerWithAddress,
  signer: SignerWithAddress,
  config: CoreProtocolSetupConfig,
): Promise<TestEcosystem | undefined> {
  if (network.name !== 'hardhat') {
    return undefined;
  }

  if (config.blockNumber >= NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[config.network]) {
    const genericTrader = await dolomiteRegistry.genericTraderProxy();
    await dolomiteMargin.ownerSetGlobalOperator(genericTrader, true);
    const registryProxy = RegistryProxy__factory.connect(dolomiteRegistry.address, governor);
    const newRegistry = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await registryProxy.upgradeTo(newRegistry.address);
    await dolomiteRegistry.ownerSetSlippageToleranceForPauseSentinel('70000000000000000'); // 7%
  }

  const testExchangeWrapper = await createContractWithAbi<TestDolomiteMarginExchangeWrapper>(
    TestDolomiteMarginExchangeWrapper__factory.abi,
    TestDolomiteMarginExchangeWrapper__factory.bytecode,
    [dolomiteMargin.address],
  );
  const testInterestSetter = await createContractWithAbi<TestInterestSetter>(
    TestInterestSetter__factory.abi,
    TestInterestSetter__factory.bytecode,
    [],
  );
  const testPriceOracle = await createContractWithAbi<TestPriceOracle>(
    TestPriceOracle__factory.abi,
    TestPriceOracle__factory.bytecode,
    [],
  );
  return {
    testExchangeWrapper: testExchangeWrapper.connect(signer),
    testInterestSetter: testInterestSetter.connect(signer),
    testPriceOracle: testPriceOracle.connect(signer),
  };
}

async function createTokenVaultActionsLibraries(
  config: CoreProtocolSetupConfig,
): Promise<Record<string, string> | undefined> {
  const tokenVaultVersion = 'IsolationModeTokenVaultV1ActionsImplV3';
  if (!(deployments[tokenVaultVersion] as any)[config.network]) {
    return undefined;
  }

  return {
    IsolationModeTokenVaultV1ActionsImpl: (deployments[tokenVaultVersion] as any)[config.network].address,
  };
}

async function createAbraEcosystem(network: Network, signer: SignerWithAddress): Promise<AbraEcosystem | undefined> {
  if (!MAGIC_GLP_MAP[network]) {
    return undefined;
  }

  return {
    magicGlp: getContract(MAGIC_GLP_MAP[network]?.address as string, IERC4626__factory.connect, signer),
  };
}

async function createArbEcosystem(network: Network, signer: SignerWithAddress): Promise<ArbEcosystem | undefined> {
  if (!ARB_MAP[network]) {
    return undefined;
  }

  return {
    arb: getContract(ARB_MAP[network]?.address as string, IARB__factory.connect, signer),
    live: {
      dArb: getContract(
        (Deployments.ARBIsolationModeVaultFactory as any)[network].address,
        ARBIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      arbRegistry: getContract(
        (Deployments.ARBRegistryProxy as any)[network].address,
        ARBRegistry__factory.connect,
        signer,
      ),
      arbRegistryProxy: getContract(
        (Deployments.ARBRegistryProxy as any)[network].address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

async function createAtlasEcosystem(network: Network, signer: SignerWithAddress): Promise<AtlasEcosystem | undefined> {
  if (!ATLAS_SI_TOKEN_MAP[network]) {
    return undefined;
  }

  return {
    siToken: getContract(ATLAS_SI_TOKEN_MAP[network] as string, IERC20__factory.connect, signer),
  };
}

async function createCamelotEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<CamelotEcosystem | undefined> {
  if (!GRAIL_WETH_V3_POOL_MAP[network]) {
    return undefined;
  }

  return {
    dpxWethV3Pool: getContract(DPX_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    grailUsdcV3Pool: getContract(GRAIL_USDC_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    grailWethV3Pool: getContract(GRAIL_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    sizeWethV3Pool: getContract(SIZE_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
  };
}

async function createGmxEcosystem(network: Network, signer: SignerWithAddress): Promise<GmxEcosystem | undefined> {
  const esGmxDistributorAddressForGlp = ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP[network];
  const esGmxDistributorAddressForGmx = ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP[network];
  if (!esGmxDistributorAddressForGlp || !esGmxDistributorAddressForGmx) {
    return undefined;
  }

  const esGmxDistributorForGlp : IEsGmxDistributor = getContract(esGmxDistributorAddressForGlp, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGlp = await impersonateOrFallback(
    await esGmxDistributorForGlp.connect(signer).admin(),
    true,
    signer,
  );
  const esGmxDistributorForGmx : IEsGmxDistributor = getContract(esGmxDistributorAddressForGmx, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGmx = await impersonateOrFallback(
    await esGmxDistributorForGmx.connect(signer).admin(),
    true,
    signer,
  );
  return {
    bnGmx: getContract(BN_GMX_MAP[network] as string, IERC20__factory.connect, signer),
    esGmx: getContract(ES_GMX_MAP[network] as string, IERC20Mintable__factory.connect, signer),
    esGmxDistributorForStakedGlp: esGmxDistributorForGlp.connect(esGmxAdminForGlp),
    esGmxDistributorForStakedGmx: esGmxDistributorForGmx.connect(esGmxAdminForGmx),
    fsGlp: getContract(FS_GLP_MAP[network] as string, IERC20__factory.connect, signer),
    glp: getContract(GLP_MAP[network] as string, IERC20__factory.connect, signer),
    glpManager: getContract(
      GLP_MANAGER_MAP[network] as string,
      IGLPManager__factory.connect,
      signer,
    ),
    glpRewardsRouter: getContract(
      GLP_REWARD_ROUTER_MAP[network] as string,
      IGLPRewardsRouterV2__factory.connect,
      signer,
    ),
    gmx: getContract(GMX_MAP[network]!.address, IERC20__factory.connect, signer),
    gmxRewardsRouterV2: getContract(
      GMX_REWARD_ROUTER_V2_MAP[network] as string,
      IGmxRewardRouterV2__factory.connect,
      signer,
    ),
    gmxRewardsRouterV3: getContract(
      GMX_REWARD_ROUTER_V3_MAP[network] as string,
      IGmxRewardRouterV2__factory.connect,
      signer,
    ),
    gmxVault: getContract(GMX_VAULT_MAP[network] as string, IGmxVault__factory.connect, signer),
    sGlp: getContract(S_GLP_MAP[network] as string, IERC20__factory.connect, signer),
    sGmx: getContract(S_GMX_MAP[network] as string, ISGMX__factory.connect, signer),
    sbfGmx: getContract(SBF_GMX_MAP[network] as string, IERC20__factory.connect, signer),
    vGlp: getContract(V_GLP_MAP[network] as string, IGmxVester__factory.connect, signer),
    vGmx: getContract(V_GMX_MAP[network] as string, IGmxVester__factory.connect, signer),
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

async function createInterestSetters(
  network: Network,
  signer: SignerWithAddress,
): Promise<InterestSetters> {
  return {
    alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.AlwaysZeroInterestSetter[network].address,
      signer,
    ),
    linearStepFunction6L94UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Stablecoin6L94ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Stablecoin8L92ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
    linearStepFunction14L86UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Altcoin14L86ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
  };
}

async function createJonesEcosystem(network: Network, signer: SignerWithAddress): Promise<JonesEcosystem | undefined> {
  if (!JONES_ECOSYSTEM_GOVERNOR_MAP[network]) {
    return undefined;
  }

  const whitelist = getContract(
    JONES_WHITELIST_CONTROLLER_MAP[network] as string,
    IJonesWhitelistController__factory.connect,
    signer,
  );
  return {
    admin: await impersonateOrFallback(JONES_ECOSYSTEM_GOVERNOR_MAP[network]!, true, signer),
    glpAdapter: getContract(
      JONES_GLP_ADAPTER_MAP[network] as string,
      IJonesGLPAdapter__factory.connect,
      signer,
    ),
    glpVaultRouter: getContract(
      JONES_GLP_VAULT_ROUTER_MAP[network] as string,
      IJonesGLPVaultRouter__factory.connect,
      signer,
    ),
    jonesWethV3Pool: getContract(JONES_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    jUSDC: getContract(JONES_JUSDC_MAP[network] as string, IERC4626__factory.connect, signer),
    jUSDCFarm: getContract(JONES_JUSDC_FARM_MAP[network] as string, IJonesUSDCFarm__factory.connect, signer),
    usdcReceiptToken: getContract(
      JONES_JUSDC_RECEIPT_TOKEN_MAP[network] as string,
      IERC4626__factory.connect,
      signer,
    ),
    whitelistController: whitelist,
    live: {
      jUSDCIsolationModeFactory: getContract(
        (Deployments.JonesUSDCIsolationModeVaultFactory as any)[network]?.address,
        JonesUSDCIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      jonesUSDCRegistry: getContract(
        (Deployments.JonesUSDCRegistryProxy as any)[network]?.address,
        IJonesUSDCRegistry__factory.connect,
        signer,
      ),
      jonesUSDCRegistryProxy: getContract(
        (Deployments.JonesUSDCRegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

async function createGmxEcosystemV2(network: Network, signer: SignerWithAddress): Promise<GmxEcosystemV2 | undefined> {
  if (!GMX_DEPOSIT_HANDLER_MAP[network]) {
    return undefined;
  }

  return {
    gmxDepositHandler: getContract(
      GMX_DEPOSIT_HANDLER_MAP[network] as string,
      IGmxDepositHandler__factory.connect,
      signer,
    ),
    gmxDepositVault: await impersonateOrFallback(GMX_DEPOSIT_VAULT_MAP[network] as string, true, signer),
    gmxEthUsdMarketToken: getContract(
      GMX_ETH_USD_MARKET_TOKEN_MAP[network] as string,
      IGmxMarketToken__factory.connect,
      signer,
    ),
    gmxDataStore: getContract(
      GMX_DATASTORE_MAP[network] as string,
      IGmxDataStore__factory.connect,
      signer,
    ),
    gmxExchangeRouter: getContract(
      GMX_EXCHANGE_ROUTER_MAP[network] as string,
      IGmxExchangeRouter__factory.connect,
      signer,
    ),
    gmxExecutor: await impersonateOrFallback(GMX_EXECUTOR_MAP[network] as string, true, signer),
    gmxReader: getContract(GMX_READER_MAP[network] as string, IGmxReader__factory.connect, signer),
    gmxRouter: getContract(GMX_ROUTER_MAP[network] as string, IGmxRouter__factory.connect, signer),
    gmxWithdrawalHandler: getContract(
      GMX_WITHDRAWAL_HANDLER_MAP[network] as string,
      IGmxWithdrawalHandler__factory.connect,
      signer,
    ),
    gmxWithdrawalVault: await impersonateOrFallback(GMX_WITHDRAWAL_VAULT_MAP[network] as string, true, signer),
  };
}

async function createLiquidityMiningEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<LiquidityMiningEcosystem | undefined> {
  if (network !== '42161') {
    return undefined;
  }

  return {
    oArbVester: VesterImplementationV1__factory.connect(deployments.VesterProxy[network].address, signer),
    oArbVesterProxy: VesterProxy__factory.connect(deployments.VesterProxy[network].address, signer),
  };
}

async function createOdosEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<OdosEcosystem | undefined> {
  if (!ODOS_ROUTER_MAP[network]) {
    return undefined;
  }

  return {
    odosRouter: IOdosRouter__factory.connect(ODOS_ROUTER_MAP[network]!, signer),
  };
}

async function createParaswapEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<ParaswapEcosystem | undefined> {
  if (!PARASWAP_AUGUSTUS_ROUTER_MAP[network]) {
    return undefined;
  }

  return {
    augustusRouter: IParaswapAugustusRouter__factory.connect(PARASWAP_AUGUSTUS_ROUTER_MAP[network]!, signer),
    feeClaimer: IParaswapFeeClaimer__factory.connect(PARASWAP_FEE_CLAIMER_MAP[network]!, signer),
    transferProxy: PARASWAP_TRANSFER_PROXY_MAP[network]!,
  };
}

async function createPendleEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PendleEcosystem | undefined> {
  if (!PENDLE_PT_GLP_2024_MARKET_MAP[network]) {
    return undefined;
  }

  return {
    pendleRouter: getContract(
      PENDLE_ROUTER_MAP[network] as string,
      IPendleRouter__factory.connect,
      signer,
    ),
    glpMar2024: {
      pendleRegistry: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        IPendleGLPRegistry__factory.connect,
        signer,
      ),
      pendleRegistryProxy: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
      ptGlpMarket: getContract(
        PENDLE_PT_GLP_2024_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptGlpToken: getContract(
        PENDLE_PT_GLP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ytGlpToken: getContract(
        PENDLE_YT_GLP_2024_TOKEN_MAP[network] as string,
        IPendleYtToken__factory.connect,
        signer,
      ),
      dPtGlp2024: getContract(
        (Deployments.PendlePtGLP2024IsolationModeVaultFactory as any)[network]?.address,
        PendlePtGLP2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
      dYtGlp2024: getContract(
        (Deployments.PendleYtGLP2024IsolationModeVaultFactory as any)[network]?.address,
        PendleYtGLP2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
    },
    rEthJun2025: {
      dPtREthJun2025: getContract(
        deployments.PendlePtREthJun2025IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleREthJun2025RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptREthMarket: getContract(
        PENDLE_PT_RETH_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptREthToken: getContract(
        PENDLE_PT_RETH_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    wstEthJun2024: {
      dPtWstEthJun2024: getContract(
        deployments.PendlePtWstEthJun2024IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2024RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptWstEthMarket: getContract(
        PENDLE_PT_WST_ETH_2024_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWstEthToken: getContract(
        PENDLE_PT_WST_ETH_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    wstEthJun2025: {
      dPtWstEthJun2025: getContract(
        deployments.PendlePtWstEthJun2025IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2025RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptWstEthMarket: getContract(
        PENDLE_PT_WST_ETH_2025_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWstEthToken: getContract(
        PENDLE_PT_WST_ETH_2025_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    syGlpToken: getContract(
      PENDLE_SY_GLP_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syREthToken: getContract(
      PENDLE_SY_RETH_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syWstEthToken: getContract(
      PENDLE_SY_WST_ETH_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
  };
}

async function createPlutusEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PlutusEcosystem | undefined> {
  if (!PLV_GLP_MAP[network]) {
    return undefined;
  }

  const sGlpAddressForPlutus = '0x2F546AD4eDD93B956C8999Be404cdCAFde3E89AE';
  return {
    plvGlp: getContract(PLV_GLP_MAP[network] as string, IERC4626__factory.connect, signer),
    plsToken: getContract(PLS_TOKEN_MAP[network] as string, IERC20__factory.connect, signer),
    plvGlpFarm: getContract(
      PLV_GLP_FARM_MAP[network] as string,
      IPlutusVaultGLPFarm__factory.connect,
      signer,
    ),
    plvGlpRouter: getContract(
      PLV_GLP_ROUTER_MAP[network] as string,
      IPlutusVaultGLPRouter__factory.connect,
      signer,
    ),
    sGlp: getContract(sGlpAddressForPlutus, IERC20__factory.connect, signer),
    live: {
      dolomiteWhitelistForGlpDepositor: getContract(
        (Deployments.DolomiteWhitelistForGlpDepositorV2 as any)[network]?.address,
        DolomiteCompatibleWhitelistForPlutusDAO__factory.connect,
        signer,
      ),
      dolomiteWhitelistForPlutusChef: getContract(
        (Deployments.DolomiteWhitelistForPlutusChef as any)[network]?.address,
        DolomiteCompatibleWhitelistForPlutusDAO__factory.connect,
        signer,
      ),
      plutusVaultRegistry: getContract(
        (Deployments.PlutusVaultRegistryProxy as any)[network]?.address,
        IPlutusVaultRegistry__factory.connect,
        signer,
      ),
      plvGlpIsolationModeFactory: getContract(
        (Deployments.PlutusVaultGLPIsolationModeVaultFactory as any)[network]?.address,
        IPlutusVaultGLPIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      plvGlpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect,
        signer,
      ),
      plvGlpIsolationModeWrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect,
        signer,
      ),
    },
  };
}

async function createPremiaEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PremiaEcosystem | undefined> {
  if (!PREMIA_WETH_V3_POOL_MAP[network]) {
    return undefined;
  }

  return {
    premiaWethV3Pool: getContract(PREMIA_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
  };
}

async function createUmamiEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<UmamiEcosystem | undefined> {
  if (!PLV_GLP_MAP[network]) {
    return undefined;
  }

  return {
    glpLink: getContract(
      UMAMI_LINK_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpUni: getContract(
      UMAMI_UNI_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpUsdc: getContract(
      UMAMI_USDC_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpWbtc: getContract(
      UMAMI_WBTC_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpWeth: getContract(
      UMAMI_WETH_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    storageViewer: getContract(
      UMAMI_STORAGE_VIEWER_MAP[network] as string,
      IUmamiAssetVaultStorageViewer__factory.connect,
      signer,
    ),
    configurator: await impersonateOrFallback(UMAMI_CONFIGURATOR_MAP[network] as string, true, signer),
  };
}

function getContract<T>(
  address: string,
  connector: (address: string, signerOrProvider: any) => T,
  signerOrProvider: Signer | Provider,
): T {
  return connector(address, signerOrProvider);
}

function getContractOpt<T>(
  address: string | undefined,
  connector: (address: string, signerOrProvider: any) => T,
  signerOrProvider: Signer | Provider,
): T | undefined {
  if (!address) {
    return undefined;
  }

  return connector(address, signerOrProvider);
}

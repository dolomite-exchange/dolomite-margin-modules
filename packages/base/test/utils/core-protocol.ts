import {
  IChainlinkAutomationRegistry,
  IChainlinkPriceOracleV3, OkxPriceOracleV3,
  OracleAggregatorV2,
} from '@dolomite-exchange/modules-oracles/src/types';
import { ApiToken, DolomiteZap } from '@dolomite-exchange/zap-sdk';
import { BigNumberish } from 'ethers';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { IChainlinkPriceOracleV1 } from 'packages/oracles/src/types';
import {
  IBorrowPositionProxyV2,
  IDepositWithdrawalProxy,
  IDolomiteAccountValuesReader,
  IDolomiteMigrator,
  IDolomiteRegistry,
  IERC20,
  IEventEmitterRegistry,
  IGenericTraderProxyV1,
  ILiquidatorAssetRegistry,
  ILiquidatorProxyV1,
  ILiquidatorProxyV4WithGenericTrader,
  IPartiallyDelayedMultiSig,
  IsolationModeFreezableLiquidatorProxy,
  IWETH,
  RegistryProxy,
} from '../../src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, SUBGRAPH_URL_MAP } from '../../src/utils/constants';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin, Expiry } from './dolomite';
import { AbraEcosystem } from './ecosystem-utils/abra';
import { ArbEcosystem } from './ecosystem-utils/arb';
import { CamelotEcosystem } from './ecosystem-utils/camelot';
import { GmxEcosystem, GmxEcosystemV2 } from './ecosystem-utils/gmx';
import { InterestSetters } from './ecosystem-utils/interest-setters';
import { JonesEcosystem } from './ecosystem-utils/jones';
import { LiquidityMiningEcosystem } from './ecosystem-utils/liquidity-mining';
import { OdosEcosystem } from './ecosystem-utils/odos';
import { ParaswapEcosystem } from './ecosystem-utils/paraswap';
import { OkxEcosystem } from './ecosystem-utils/okx';
import { PendleEcosystem } from './ecosystem-utils/pendle';
import { PlutusEcosystem } from './ecosystem-utils/plutus';
import { PremiaEcosystem } from './ecosystem-utils/premia';
import { TestEcosystem } from './ecosystem-utils/testers';
import { UmamiEcosystem } from './ecosystem-utils/umami';
import { CoreProtocolConfig } from './setup';

export interface LibraryMaps {
  tokenVaultActionsImpl: Record<string, string>;
  unwrapperTraderImpl: Record<string, string>;
  wrapperTraderImpl: Record<string, string>;
}

interface CoreProtocolTokens {
  usdc: IERC20;
  weth: IWETH;
}

interface CoreProtocolMarketIds {
  usdc: BigNumberish;
  weth: BigNumberish;
}

interface CoreProtocolTokensArbitrumOne extends CoreProtocolTokens {
  arb: IERC20;
  dai: IERC20;
  dArb: IERC20;
  dfsGlp: IERC20;
  dGmx: IERC20;
  dGmArb: IERC20;
  dGmBtc: IERC20;
  dGmEth: IERC20;
  dGmLink: IERC20;
  dPtGlp: IERC20;
  dPtREthJun2025: IERC20;
  dPtWeEthApr2024: IERC20;
  dPtWstEthJun2024: IERC20;
  dPtWstEthJun2025: IERC20;
  dpx: IERC20;
  dYtGlp: IERC20;
  eEth: IERC20;
  ezEth: IERC20;
  sGlp: IERC20;
  gmx: IERC20;
  gmxBtc: IERC20;
  grail: IERC20;
  jones: IERC20;
  link: IERC20;
  magic: IERC20;
  nativeUsdc: IERC20;
  premia: IERC20;
  rEth: IERC20;
  rsEth: IERC20;
  radiant: IERC20;
  pendle: IERC20;
  size: IERC20;
  stEth: IERC20;
  wbtc: IERC20;
  weEth: IERC20;
  wstEth: IERC20;
  xai: IERC20;
}

interface CoreProtocolMarketIdsArbitrumOne extends CoreProtocolMarketIds {
  arb: BigNumberish;
  dArb: BigNumberish;
  dfsGlp: BigNumberish;
  dGmx: BigNumberish;
  dGmArb: BigNumberish;
  dGmBtc: BigNumberish;
  dGmEth: BigNumberish;
  dGmLink: BigNumberish;
  djUsdc: BigNumberish;
  djUsdcOld: BigNumberish;
  dplvGlp: BigNumberish;
  dPtEzEthJun2024: BigNumberish;
  dPtGlpMar2024: BigNumberish;
  dPtWeEthApr2024: BigNumberish;
  dPtWeEthJun2024: BigNumberish;
  dPtREthJun2025: BigNumberish;
  dPtWstEthJun2024: BigNumberish;
  dPtWstEthJun2025: BigNumberish;
  dpx: BigNumberish;
  dYtGlp: BigNumberish;
  ezEth: BigNumberish;
  gmx: BigNumberish;
  grail: BigNumberish;
  jones: BigNumberish;
  magic: BigNumberish;
  magicGlp: BigNumberish;
  mim: BigNumberish;
  nativeUsdc: BigNumberish;
  premia: BigNumberish;
  rEth: BigNumberish;
  radiant: BigNumberish;
  pendle: BigNumberish;
  usdt: BigNumberish;
  sGlp: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  wstEth: BigNumberish;
  xai: BigNumberish;
}

export interface CoreProtocolParams<T extends NetworkType> {
  config: CoreProtocolConfig<T>;
  governance: SignerWithAddressWithSafety;
  hhUser1: SignerWithAddressWithSafety;
  hhUser2: SignerWithAddressWithSafety;
  hhUser3: SignerWithAddressWithSafety;
  hhUser4: SignerWithAddressWithSafety;
  hhUser5: SignerWithAddressWithSafety;
  borrowPositionProxyV2: IBorrowPositionProxyV2;
  constants: CoreProtocolConstants<T>;
  chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  delayedMultiSig: IPartiallyDelayedMultiSig;
  depositWithdrawalProxy: IDepositWithdrawalProxy;
  dolomiteMargin: DolomiteMargin<T>;
  dolomiteRegistry: IDolomiteRegistry;
  dolomiteRegistryProxy: RegistryProxy;
  eventEmitterRegistry: IEventEmitterRegistry;
  eventEmitterRegistryProxy: RegistryProxy;
  expiry: Expiry<T>;
  freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  genericTraderProxy: IGenericTraderProxyV1;
  interestSetters: InterestSetters;
  libraries: LibraryMaps;
  liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  liquidatorProxyV1: ILiquidatorProxyV1;
  liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  oracleAggregatorV2: OracleAggregatorV2;
  testEcosystem: TestEcosystem | undefined;
  marketIds: CoreProtocolMarketIds;
  apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  tokens: CoreProtocolTokens;
}

export interface CoreProtocolConstants<T extends NetworkType> {
  slippageToleranceForPauseSentinel: BigNumberish;
  chainlinkAggregators: typeof CHAINLINK_PRICE_AGGREGATORS_MAP[T];
}

export abstract class CoreProtocolAbstract<T extends NetworkType> {
  /// =========================
  /// Config and Signers
  /// =========================
  /**
   * Config passed through at Core Protocol's creation time
   */
  public readonly config: CoreProtocolConfig<T>;
  public readonly zap: DolomiteZap;
  public readonly governance: SignerWithAddressWithSafety;
  public readonly hhUser1: SignerWithAddressWithSafety;
  public readonly hhUser2: SignerWithAddressWithSafety;
  public readonly hhUser3: SignerWithAddressWithSafety;
  public readonly hhUser4: SignerWithAddressWithSafety;
  public readonly hhUser5: SignerWithAddressWithSafety;
  /// =========================
  /// Contracts and Ecosystems
  /// =========================
  public readonly borrowPositionProxyV2: IBorrowPositionProxyV2;
  public readonly chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  public readonly chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  public readonly constants: CoreProtocolConstants<T>;
  public readonly delayedMultiSig: IPartiallyDelayedMultiSig;
  public readonly depositWithdrawalProxy: IDepositWithdrawalProxy;
  public readonly dolomiteMargin: DolomiteMargin<T>;
  public readonly dolomiteRegistry: IDolomiteRegistry;
  public readonly dolomiteRegistryProxy: RegistryProxy;
  public readonly eventEmitterRegistry: IEventEmitterRegistry;
  public readonly eventEmitterRegistryProxy: RegistryProxy;
  public readonly expiry: Expiry<T>;
  public readonly freezableLiquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  public readonly genericTraderProxy: IGenericTraderProxyV1;
  public readonly interestSetters: InterestSetters;
  public readonly libraries: LibraryMaps;
  public readonly liquidatorAssetRegistry: ILiquidatorAssetRegistry;
  public readonly liquidatorProxyV1: ILiquidatorProxyV1;
  public readonly liquidatorProxyV4: ILiquidatorProxyV4WithGenericTrader;
  public readonly oracleAggregatorV2: OracleAggregatorV2;
  public readonly testEcosystem: TestEcosystem | undefined;
  /// =========================
  /// Markets and Tokens
  /// =========================
  /**
   * A mapping from token's symbol to its market ID
   */
  public readonly marketIds: CoreProtocolMarketIds;
  public readonly apiTokens: {
    usdc: ApiToken;
    weth: ApiToken;
  };
  public readonly tokens: CoreProtocolTokens;

  constructor(params: CoreProtocolParams<T>) {
    this.config = params.config;
    this.zap = new DolomiteZap({
      network: this.config.networkNumber,
      subgraphUrl: SUBGRAPH_URL_MAP[this.config.network],
      web3Provider: params.hhUser1.provider!,
      defaultBlockTag: params.config.blockNumber,
    });
    this.governance = params.governance;
    this.hhUser1 = params.hhUser1;
    this.hhUser2 = params.hhUser2;
    this.hhUser3 = params.hhUser3;
    this.hhUser4 = params.hhUser4;
    this.hhUser5 = params.hhUser5;
    this.borrowPositionProxyV2 = params.borrowPositionProxyV2;
    this.chainlinkPriceOracleV1 = params.chainlinkPriceOracleV1;
    this.chainlinkPriceOracleV3 = params.chainlinkPriceOracleV3;
    this.constants = params.constants;
    this.delayedMultiSig = params.delayedMultiSig;
    this.depositWithdrawalProxy = params.depositWithdrawalProxy;
    this.dolomiteMargin = params.dolomiteMargin;
    this.dolomiteRegistry = params.dolomiteRegistry;
    this.dolomiteRegistryProxy = params.dolomiteRegistryProxy;
    this.eventEmitterRegistry = params.eventEmitterRegistry;
    this.eventEmitterRegistryProxy = params.eventEmitterRegistryProxy;
    this.expiry = params.expiry;
    this.freezableLiquidatorProxy = params.freezableLiquidatorProxy;
    this.genericTraderProxy = params.genericTraderProxy;
    this.interestSetters = params.interestSetters;
    this.libraries = params.libraries;
    this.liquidatorAssetRegistry = params.liquidatorAssetRegistry;
    this.liquidatorProxyV1 = params.liquidatorProxyV1;
    this.liquidatorProxyV4 = params.liquidatorProxyV4;
    this.oracleAggregatorV2 = params.oracleAggregatorV2;
    this.testEcosystem = params.testEcosystem;
    this.marketIds = params.marketIds;
    this.apiTokens = params.apiTokens;
    this.tokens = params.tokens;
  }

  public abstract get network(): T;
}

interface CoreProtocolParamsArbitrumOne {
  abraEcosystem: AbraEcosystem;
  arbEcosystem: ArbEcosystem;
  camelotEcosystem: CamelotEcosystem;
  chainlinkAutomationRegistry: IChainlinkAutomationRegistry;
  chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  dolomiteAccountValuesReader: IDolomiteAccountValuesReader;
  dolomiteMigrator: IDolomiteMigrator;
  gmxEcosystem: GmxEcosystem;
  gmxEcosystemV2: GmxEcosystemV2;
  jonesEcosystem: JonesEcosystem;
  liquidityMiningEcosystem: LiquidityMiningEcosystem;
  marketIds: CoreProtocolMarketIdsArbitrumOne;
  odosEcosystem: OdosEcosystem;
  paraswapEcosystem: ParaswapEcosystem;
  pendleEcosystem: PendleEcosystem;
  plutusEcosystem: PlutusEcosystem;
  premiaEcosystem: PremiaEcosystem;
  tokens: CoreProtocolTokensArbitrumOne;
  umamiEcosystem: UmamiEcosystem;
}

export class CoreProtocolArbitrumOne extends CoreProtocolAbstract<Network.ArbitrumOne> {
  public readonly abraEcosystem: AbraEcosystem;
  public readonly arbEcosystem: ArbEcosystem;
  public readonly camelotEcosystem: CamelotEcosystem;
  public readonly chainlinkAutomationRegistry: IChainlinkAutomationRegistry;
  public readonly dolomiteAccountValuesReader: IDolomiteAccountValuesReader;
  public readonly dolomiteMigrator: IDolomiteMigrator;
  public readonly gmxEcosystem: GmxEcosystem;
  public readonly gmxEcosystemV2: GmxEcosystemV2;
  public readonly jonesEcosystem: JonesEcosystem;
  public readonly liquidityMiningEcosystem: LiquidityMiningEcosystem;
  public override readonly marketIds: CoreProtocolMarketIdsArbitrumOne;
  public readonly odosEcosystem: OdosEcosystem;
  public readonly paraswapEcosystem: ParaswapEcosystem;
  public readonly pendleEcosystem: PendleEcosystem;
  public readonly plutusEcosystem: PlutusEcosystem;
  public readonly premiaEcosystem: PremiaEcosystem;
  public override readonly tokens: CoreProtocolTokensArbitrumOne;
  public readonly umamiEcosystem: UmamiEcosystem;
  public readonly network: Network.ArbitrumOne = Network.ArbitrumOne;

  constructor(
    params: CoreProtocolParams<Network.ArbitrumOne>,
    arbParams: CoreProtocolParamsArbitrumOne,
  ) {
    super(params);
    this.abraEcosystem = arbParams.abraEcosystem;
    this.arbEcosystem = arbParams.arbEcosystem;
    this.camelotEcosystem = arbParams.camelotEcosystem;
    this.chainlinkAutomationRegistry = arbParams.chainlinkAutomationRegistry;
    this.dolomiteAccountValuesReader = arbParams.dolomiteAccountValuesReader;
    this.dolomiteMigrator = arbParams.dolomiteMigrator;
    this.gmxEcosystem = arbParams.gmxEcosystem;
    this.gmxEcosystemV2 = arbParams.gmxEcosystemV2;
    this.jonesEcosystem = arbParams.jonesEcosystem;
    this.liquidityMiningEcosystem = arbParams.liquidityMiningEcosystem;
    this.marketIds = arbParams.marketIds;
    this.odosEcosystem = arbParams.odosEcosystem;
    this.paraswapEcosystem = arbParams.paraswapEcosystem;
    this.pendleEcosystem = arbParams.pendleEcosystem;
    this.plutusEcosystem = arbParams.plutusEcosystem;
    this.premiaEcosystem = arbParams.premiaEcosystem;
    this.tokens = arbParams.tokens;
    this.umamiEcosystem = arbParams.umamiEcosystem;
  }
}

export interface CoreProtocolParamsBase {
  paraswapEcosystem: ParaswapEcosystem;
}

export class CoreProtocolBase extends CoreProtocolAbstract<Network.Base> {

  public readonly paraswapEcosystem: ParaswapEcosystem;
  public readonly network: Network.Base = Network.Base;

  constructor(
    params: CoreProtocolParams<Network.Base>,
    baseParams: CoreProtocolParamsBase,
  ) {
    super(params);
    this.paraswapEcosystem = baseParams.paraswapEcosystem;
  }
}

interface CoreProtocolTokensMantle extends CoreProtocolTokens {
  wmnt: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsMantle extends CoreProtocolMarketIds {
  wmnt: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsMantle {
  marketIds: CoreProtocolMarketIdsMantle;
  tokens: CoreProtocolTokensMantle;
}

export class CoreProtocolMantle extends CoreProtocolAbstract<Network.Mantle> {

  public override readonly marketIds: CoreProtocolMarketIdsMantle;
  public override readonly tokens: CoreProtocolTokensMantle;
  public readonly network: Network.Mantle = Network.Mantle;

  constructor(
    params: CoreProtocolParams<Network.Mantle>,
    mantleParams: CoreProtocolParamsMantle,
  ) {
    super(params);
    this.marketIds = mantleParams.marketIds;
    this.tokens = mantleParams.tokens;
  }
}

interface CoreProtocolTokensPolygonZkEvm extends CoreProtocolTokens {
  dai: IERC20;
  link: IERC20;
  matic: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsPolygonZkEvm extends CoreProtocolMarketIds {
  dai: BigNumberish;
  link: BigNumberish;
  matic: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsPolygonZkEvm {
  marketIds: CoreProtocolMarketIdsPolygonZkEvm;
  paraswapEcosystem: ParaswapEcosystem;
  tokens: CoreProtocolTokensPolygonZkEvm;
}

export class CoreProtocolPolygonZkEvm extends CoreProtocolAbstract<Network.PolygonZkEvm> {

  public readonly paraswapEcosystem: ParaswapEcosystem;

  public override readonly marketIds: CoreProtocolMarketIdsPolygonZkEvm;
  public override readonly tokens: CoreProtocolTokensPolygonZkEvm;
  public readonly network: Network.PolygonZkEvm = Network.PolygonZkEvm;

  constructor(
    params: CoreProtocolParams<Network.PolygonZkEvm>,
    zkEvmParams: CoreProtocolParamsPolygonZkEvm,
  ) {
    super(params);
    this.marketIds = zkEvmParams.marketIds;
    this.paraswapEcosystem = zkEvmParams.paraswapEcosystem;
    this.tokens = zkEvmParams.tokens;
  }
}

interface CoreProtocolTokensXLayer extends CoreProtocolTokens {
  wokb: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsXLayer extends CoreProtocolMarketIds {
  wokb: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsXLayer {
  marketIds: CoreProtocolMarketIdsXLayer;
  okxEcosystem: OkxEcosystem;
  okxPriceOracleV3: OkxPriceOracleV3;
  tokens: CoreProtocolTokensXLayer;
}

export class CoreProtocolXLayer extends CoreProtocolAbstract<Network.XLayer> {

  public readonly okxEcosystem: OkxEcosystem;
  public readonly okxPriceOracleV3: OkxPriceOracleV3;

  public override readonly marketIds: CoreProtocolMarketIdsXLayer;
  public override readonly tokens: CoreProtocolTokensXLayer;
  public readonly network: Network.XLayer = Network.XLayer;

  constructor(
    params: CoreProtocolParams<Network.XLayer>,
    xLayerParams: CoreProtocolParamsXLayer,
  ) {
    super(params);
    this.marketIds = xLayerParams.marketIds;
    this.okxEcosystem = xLayerParams.okxEcosystem;
    this.okxPriceOracleV3 = xLayerParams.okxPriceOracleV3;
    this.tokens = xLayerParams.tokens;
  }
}

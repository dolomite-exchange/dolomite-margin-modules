import { BigNumberish } from 'ethers';
import {
  ChroniclePriceOracleV3,
  IChainlinkAutomationRegistry,
  IChainlinkPriceOracleV1,
  IChainlinkPriceOracleV3, IChaosLabsPriceOracleV3,
  RedstonePriceOracleV3,
} from 'packages/oracles/src/types';
import {
  DolomiteERC20,
  DolomiteERC20WithPayable,
  DolomiteERC4626,
  IDolomiteAccountValuesReader,
  IDolomiteMigrator,
  IERC20,
  RegistryProxy,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { AbraEcosystem } from '../ecosystem-utils/abra';
import { ArbEcosystem } from '../ecosystem-utils/arb';
import { CamelotEcosystem } from '../ecosystem-utils/camelot';
import { GmxEcosystem, GmxV2Ecosystem } from '../ecosystem-utils/gmx';
import { JonesEcosystem } from '../ecosystem-utils/jones';
import { LiquidityMiningEcosystemArbitrumOne } from '../ecosystem-utils/liquidity-mining';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import { ParaswapEcosystem } from '../ecosystem-utils/paraswap';
import { PendleEcosystemArbitrumOne } from '../ecosystem-utils/pendle';
import { PlutusEcosystem } from '../ecosystem-utils/plutus';
import { PremiaEcosystem } from '../ecosystem-utils/premia';
import { UmamiEcosystem } from '../ecosystem-utils/umami';
import {
  CoreProtocolAbstract,
  CoreProtocolDolomiteTokens,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';
import { GlvEcosystem } from '../ecosystem-utils/glv';

interface CoreProtocolTokensArbitrumOne extends CoreProtocolTokens<Network.ArbitrumOne> {
  aave: IERC20;
  arb: IERC20;
  dai: IERC20;
  dArb: IERC20;
  dfsGlp: IERC20;
  dGlvBtc: IERC20;
  dGlvEth: IERC20;
  dGmx: IERC20;
  dGmArb: IERC20;
  dGmBtc: IERC20;
  dGmEth: IERC20;
  dGmLink: IERC20;
  djUsdcV1: IERC20;
  djUsdcV2: IERC20;
  dPtGlp: IERC20;
  dPtREthJun2025: IERC20;
  dPtWeEthApr2024: IERC20;
  dPtWstEthJun2024: IERC20;
  dPtWstEthJun2025: IERC20;
  dpx: IERC20;
  dYtGlp: IERC20;
  ethPlus: IERC20;
  eEth: IERC20;
  ezEth: IERC20;
  ezEthReversed: IERC20;
  eUsd: IERC20;
  frax: IERC20;
  gmx: IERC20;
  gmxBtc: IERC20;
  grai: IERC20;
  grail: IERC20;
  jones: IERC20;
  link: IERC20;
  mGlp: IERC20;
  magic: IERC20;
  mim: IERC20;
  nativeUsdc: IERC20;
  pendle: IERC20;
  premia: IERC20;
  pumpBtc: IERC20;
  rEth: IERC20;
  rsEth: IERC20;
  rsEthReversed: IERC20;
  radiant: IERC20;
  sGlp: IERC20;
  sUsds: IERC20;
  size: IERC20;
  sol: IERC20;
  stEth: IERC20;
  tbtc: IERC20;
  uni: IERC20;
  uniBtc: IERC20;
  usde: IERC20;
  usdl: IERC20;
  usdm: IERC20;
  usds: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
  weEth: IERC20;
  woEth: IERC20;
  wstEth: IERC20;
  wusdl: IERC20;
  wusdm: IERC20;
  xai: IERC20;
}

interface CoreProtocolDolomiteTokensArbitrumOne extends CoreProtocolDolomiteTokens<Network.ArbitrumOne> {
  bridgedUsdc: DolomiteERC4626;
  dai: DolomiteERC4626;
  usdt: DolomiteERC4626;
  wbtc: DolomiteERC4626;
}

interface CoreProtocolArbitrumOneDTokens {
  usdc: DolomiteERC20;
  wbtc: DolomiteERC20;
  weth: DolomiteERC20WithPayable;
  usdcProxy: RegistryProxy;
  wbtcProxy: RegistryProxy;
  wethProxy: RegistryProxy;
}

interface CoreProtocolMarketIdsArbitrumOne extends CoreProtocolMarketIds {
  aave: BigNumberish;
  arb: BigNumberish;
  dArb: BigNumberish;
  dfsGlp: BigNumberish;
  dGlvBtc: BigNumberish;
  dGlvEth: BigNumberish;
  dGmx: BigNumberish;
  dGmAaveUsd: BigNumberish;
  dGmArbUsd: BigNumberish;
  dGmBtc: BigNumberish;
  dGmBtcUsd: BigNumberish;
  dGmDogeUsd: BigNumberish;
  dGmEth: BigNumberish;
  dGmEthUsd: BigNumberish;
  dGmGmxUsd: BigNumberish;
  dGmLinkUsd: BigNumberish;
  dGmSolUsd: BigNumberish;
  dGmUniUsd: BigNumberish;
  dGmWstEthUsd: BigNumberish;
  djUsdcV1: BigNumberish;
  djUsdcV2: BigNumberish;
  dplvGlp: BigNumberish;
  dPtEzEthJun2024: BigNumberish;
  dPtEzEthSep2024: BigNumberish;
  dPtGlpMar2024: BigNumberish;
  dPtWeEthApr2024: BigNumberish;
  dPtWeEthJun2024: BigNumberish;
  dPtWeEthSep2024: BigNumberish;
  dPtREthJun2025: BigNumberish;
  dPtRsEthSep2024: BigNumberish;
  dPtWstEthJun2024: BigNumberish;
  dPtWstEthJun2025: BigNumberish;
  dai: BigNumberish;
  dpx: BigNumberish;
  dYtGlp: BigNumberish;
  eUsd: BigNumberish;
  ethPlus: BigNumberish;
  ezEth: BigNumberish;
  gmx: BigNumberish;
  grai: BigNumberish;
  grail: BigNumberish;
  jones: BigNumberish;
  link: BigNumberish;
  magic: BigNumberish;
  magicGlp: BigNumberish;
  mim: BigNumberish;
  nativeUsdc: BigNumberish;
  pendle: BigNumberish;
  premia: BigNumberish;
  pumpBtc: BigNumberish;
  rEth: BigNumberish;
  rsEth: BigNumberish;
  radiant: BigNumberish;
  sGlp: BigNumberish;
  sUsds: BigNumberish;
  tbtc: BigNumberish;
  uni: BigNumberish;
  uniBtc: BigNumberish;
  usds: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  woEth: BigNumberish;
  wstEth: BigNumberish;
  wusdl: BigNumberish;
  wusdm: BigNumberish;
  xai: BigNumberish;
}

interface CoreProtocolParamsArbitrumOne {
  abraEcosystem: AbraEcosystem;
  arbEcosystem: ArbEcosystem;
  camelotEcosystem: CamelotEcosystem;
  chainlinkAutomationRegistry: IChainlinkAutomationRegistry;
  chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
  chaosLabsPriceOracleV3: IChaosLabsPriceOracleV3;
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  dolomiteAccountValuesReader: IDolomiteAccountValuesReader;
  dolomiteMigrator: IDolomiteMigrator;
  dolomiteTokens: CoreProtocolDolomiteTokensArbitrumOne;
  dTokens: CoreProtocolArbitrumOneDTokens;
  glvEcosystem: GlvEcosystem;
  gmxEcosystem: GmxEcosystem;
  gmxEcosystemV2: GmxV2Ecosystem;
  jonesEcosystem: JonesEcosystem;
  liquidityMiningEcosystem: LiquidityMiningEcosystemArbitrumOne;
  marketIds: CoreProtocolMarketIdsArbitrumOne;
  odosEcosystem: OdosEcosystem;
  paraswapEcosystem: ParaswapEcosystem;
  pendleEcosystem: PendleEcosystemArbitrumOne;
  plutusEcosystem: PlutusEcosystem;
  premiaEcosystem: PremiaEcosystem;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensArbitrumOne;
  umamiEcosystem: UmamiEcosystem;
}

export class CoreProtocolArbitrumOne extends CoreProtocolAbstract<Network.ArbitrumOne> {
  public readonly abraEcosystem: AbraEcosystem;
  public readonly arbEcosystem: ArbEcosystem;
  public readonly camelotEcosystem: CamelotEcosystem;
  public readonly chainlinkAutomationRegistry: IChainlinkAutomationRegistry;
  public readonly chaosLabsPriceOracleV3: IChaosLabsPriceOracleV3;
  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly dolomiteAccountValuesReader: IDolomiteAccountValuesReader;
  public readonly dolomiteMigrator: IDolomiteMigrator;
  public readonly dolomiteTokens: CoreProtocolDolomiteTokensArbitrumOne;
  public readonly dTokens: CoreProtocolArbitrumOneDTokens;
  public readonly glvEcosystem: GlvEcosystem;
  public readonly gmxEcosystem: GmxEcosystem;
  public readonly gmxV2Ecosystem: GmxV2Ecosystem;
  public readonly jonesEcosystem: JonesEcosystem;
  public readonly liquidityMiningEcosystem: LiquidityMiningEcosystemArbitrumOne;
  public override readonly marketIds: CoreProtocolMarketIdsArbitrumOne;
  public readonly odosEcosystem: OdosEcosystem;
  public readonly paraswapEcosystem: ParaswapEcosystem;
  public readonly pendleEcosystem: PendleEcosystemArbitrumOne;
  public readonly plutusEcosystem: PlutusEcosystem;
  public readonly premiaEcosystem: PremiaEcosystem;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public override readonly tokens: CoreProtocolTokensArbitrumOne;
  public readonly umamiEcosystem: UmamiEcosystem;
  public readonly network: Network.ArbitrumOne = Network.ArbitrumOne;

  constructor(params: CoreProtocolParams<Network.ArbitrumOne>, arbParams: CoreProtocolParamsArbitrumOne) {
    super(params);
    this.abraEcosystem = arbParams.abraEcosystem;
    this.arbEcosystem = arbParams.arbEcosystem;
    this.camelotEcosystem = arbParams.camelotEcosystem;
    this.chainlinkAutomationRegistry = arbParams.chainlinkAutomationRegistry;
    this.chaosLabsPriceOracleV3 = arbParams.chaosLabsPriceOracleV3;
    this.chroniclePriceOracleV3 = arbParams.chroniclePriceOracleV3;
    this.dolomiteAccountValuesReader = arbParams.dolomiteAccountValuesReader;
    this.dolomiteMigrator = arbParams.dolomiteMigrator;
    this.dolomiteTokens = arbParams.dolomiteTokens;
    this.dTokens = arbParams.dTokens;
    this.glvEcosystem = arbParams.glvEcosystem;
    this.gmxEcosystem = arbParams.gmxEcosystem;
    this.gmxV2Ecosystem = arbParams.gmxEcosystemV2;
    this.jonesEcosystem = arbParams.jonesEcosystem;
    this.liquidityMiningEcosystem = arbParams.liquidityMiningEcosystem;
    this.marketIds = arbParams.marketIds;
    this.odosEcosystem = arbParams.odosEcosystem;
    this.paraswapEcosystem = arbParams.paraswapEcosystem;
    this.pendleEcosystem = arbParams.pendleEcosystem;
    this.plutusEcosystem = arbParams.plutusEcosystem;
    this.premiaEcosystem = arbParams.premiaEcosystem;
    this.redstonePriceOracleV3 = arbParams.redstonePriceOracleV3;
    this.tokens = arbParams.tokens;
    this.umamiEcosystem = arbParams.umamiEcosystem;
  }
}

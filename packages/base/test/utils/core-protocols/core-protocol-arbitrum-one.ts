import { BigNumberish } from 'ethers';
import {
  IChainlinkAutomationRegistry,
  IChainlinkPriceOracleV1,
  IChainlinkPriceOracleV3, RedstonePriceOracleV3,
} from 'packages/oracles/src/types';
import { IDolomiteAccountValuesReader, IDolomiteMigrator, IERC20 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { AbraEcosystem } from '../ecosystem-utils/abra';
import { ArbEcosystem } from '../ecosystem-utils/arb';
import { CamelotEcosystem } from '../ecosystem-utils/camelot';
import { GmxEcosystem, GmxEcosystemV2 } from '../ecosystem-utils/gmx';
import { JonesEcosystem } from '../ecosystem-utils/jones';
import { MineralLiquidityMiningEcosystem, OARBLiquidityMiningEcosystem } from '../ecosystem-utils/liquidity-mining';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import { ParaswapEcosystem } from '../ecosystem-utils/paraswap';
import { PendleEcosystem } from '../ecosystem-utils/pendle';
import { PlutusEcosystem } from '../ecosystem-utils/plutus';
import { PremiaEcosystem } from '../ecosystem-utils/premia';
import { UmamiEcosystem } from '../ecosystem-utils/umami';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensArbitrumOne extends CoreProtocolTokens<Network.ArbitrumOne> {
  arb: IERC20;
  dai: IERC20;
  dArb: IERC20;
  dfsGlp: IERC20;
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
  eEth: IERC20;
  ezEth: IERC20;
  sGlp: IERC20;
  frax: IERC20;
  gmx: IERC20;
  gmxBtc: IERC20;
  grai: IERC20;
  grail: IERC20;
  jones: IERC20;
  link: IERC20;
  magic: IERC20;
  mim: IERC20;
  nativeUsdc: IERC20;
  premia: IERC20;
  rEth: IERC20;
  rsEth: IERC20;
  radiant: IERC20;
  pendle: IERC20;
  size: IERC20;
  stEth: IERC20;
  uni: IERC20;
  usdt: IERC20;
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
  dGmBtcSingleSided: BigNumberish;
  dGmEth: BigNumberish;
  dGmEthSingleSided: BigNumberish;
  dGmLink: BigNumberish;
  djUsdcV1: BigNumberish;
  djUsdcV2: BigNumberish;
  dplvGlp: BigNumberish;
  dPtEzEthJun2024: BigNumberish;
  dPtGlpMar2024: BigNumberish;
  dPtWeEthApr2024: BigNumberish;
  dPtWeEthJun2024: BigNumberish;
  dPtREthJun2025: BigNumberish;
  dPtWstEthJun2024: BigNumberish;
  dPtWstEthJun2025: BigNumberish;
  dai: BigNumberish;
  dpx: BigNumberish;
  dYtGlp: BigNumberish;
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
  premia: BigNumberish;
  rEth: BigNumberish;
  radiant: BigNumberish;
  pendle: BigNumberish;
  sGlp: BigNumberish;
  uni: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  wstEth: BigNumberish;
  xai: BigNumberish;
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
  mineralLiquidityMiningEcosystem: MineralLiquidityMiningEcosystem;
  oArbLiquidityMiningEcosystem: OARBLiquidityMiningEcosystem;
  marketIds: CoreProtocolMarketIdsArbitrumOne;
  odosEcosystem: OdosEcosystem;
  paraswapEcosystem: ParaswapEcosystem;
  pendleEcosystem: PendleEcosystem;
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
  public readonly dolomiteAccountValuesReader: IDolomiteAccountValuesReader;
  public readonly dolomiteMigrator: IDolomiteMigrator;
  public readonly gmxEcosystem: GmxEcosystem;
  public readonly gmxEcosystemV2: GmxEcosystemV2;
  public readonly jonesEcosystem: JonesEcosystem;
  public readonly mineralLiquidityMiningEcosystem: MineralLiquidityMiningEcosystem;
  public override readonly marketIds: CoreProtocolMarketIdsArbitrumOne;
  public readonly oArbLiquidityMiningEcosystem: OARBLiquidityMiningEcosystem;
  public readonly odosEcosystem: OdosEcosystem;
  public readonly paraswapEcosystem: ParaswapEcosystem;
  public readonly pendleEcosystem: PendleEcosystem;
  public readonly plutusEcosystem: PlutusEcosystem;
  public readonly premiaEcosystem: PremiaEcosystem;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
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
    this.mineralLiquidityMiningEcosystem = arbParams.mineralLiquidityMiningEcosystem;
    this.oArbLiquidityMiningEcosystem = arbParams.oArbLiquidityMiningEcosystem;
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
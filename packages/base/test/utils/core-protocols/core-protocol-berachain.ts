import {
  ChainsightPriceOracleV3,
  ChroniclePriceOracleV3,
  RedstonePriceOracleV3,
} from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumberish } from 'ethers';
import { DolomiteERC4626, DolomiteERC4626WithPayable, IERC20, IWETH } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { OogaBoogaEcosystem } from '../ecosystem-utils/ooga-booga';
import {
  CoreProtocolAbstract,
  CoreProtocolDolomiteTokens,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
  DolomiteWETHType,
} from './core-protocol-abstract';
import { TokenomicsEcosystem } from '../ecosystem-utils/tokenomics';
import { TokenomicsAirdropEcosystem } from '../ecosystem-utils/tokenomics-airdrop';
import { IBGT } from 'packages/berachain/src/types';
import { BerachainRewardsEcosystem } from '../ecosystem-utils/berachain-rewards';
import { PendleEcosystemBerachain } from '../ecosystem-utils/pendle';

export interface CoreProtocolTokensBerachain extends CoreProtocolTokens<Network.Berachain> {
  beraEth: IERC20;
  bgt: IBGT;
  btcPlaceholder: IERC20;
  byusd: IERC20;
  deUsd: IERC20;
  diBgt: IERC20;
  dolo: IERC20;
  eBtc: IERC20;
  fbtc: IERC20;
  henlo: IERC20;
  honey: IERC20;
  iBera: IERC20;
  iBgt: IERC20;
  ir: IERC20;
  kdk: IERC20;
  lbtc: IERC20;
  nect: IERC20;
  ohm: IERC20;
  oriBgt: IERC20;
  polRUsd: IERC20;
  ptIBgt: IERC20;
  pumpBtc: IERC20;
  rsEth: IERC20;
  rswEth: IERC20;
  rUsd: IERC20;
  stonebtc: IERC20;
  sUsda: IERC20;
  sUsde: IERC20;
  sWbera: IERC20;
  sdeUsd: IERC20;
  srUsd: IERC20;
  stBtc: IERC20;
  solvBtc: IERC20;
  stone: IERC20;
  uniBtc: IERC20;
  usd0: IERC20;
  usd0pp: IERC20;
  usda: IERC20;
  usde: IERC20;
  usdt: IERC20;
  wbera: IWETH;
  wbtc: IERC20;
  weEth: IERC20;
  wgBera: IERC20;
  xSolvBtc: IERC20;
  ylBtcLst: IERC20;
  ylPumpBtc: IERC20;
  ylStEth: IERC20;
}

export interface CoreProtocolDolomiteTokensBerachain extends CoreProtocolDolomiteTokens {
  beraEth: DolomiteERC4626;
  deUsd: DolomiteERC4626;
  eBtc: DolomiteERC4626;
  honey: DolomiteERC4626;
  lbtc: DolomiteERC4626;
  nect: DolomiteERC4626;
  pumpBtc: DolomiteERC4626;
  rsEth: DolomiteERC4626;
  rswEth: DolomiteERC4626;
  rUsd: DolomiteERC4626;
  sbtc: DolomiteERC4626;
  sUsda: DolomiteERC4626;
  sUsde: DolomiteERC4626;
  sdeUsd: DolomiteERC4626;
  srUsd: DolomiteERC4626;
  stBtc: DolomiteERC4626;
  solvBtc: DolomiteERC4626;
  solvBtcBbn: DolomiteERC4626;
  stone: DolomiteERC4626;
  uniBtc: DolomiteERC4626;
  usd0: DolomiteERC4626;
  usd0pp: DolomiteERC4626;
  usda: DolomiteERC4626;
  usdc: DolomiteERC4626;
  usde: DolomiteERC4626;
  usdt: DolomiteERC4626;
  wbera: DolomiteERC4626WithPayable;
  wbtc: DolomiteERC4626;
  weth: DolomiteWETHType<Network.Berachain>;
  weEth: DolomiteERC4626;
  ylBtcLst: DolomiteERC4626;
  ylPumpBtc: DolomiteERC4626;
  ylStEth: DolomiteERC4626;
}

interface CoreProtocolMarketIdsBerachain extends CoreProtocolMarketIds {
  beraEth: BigNumberish;
  byusd: BigNumberish;
  deUsd: BigNumberish;
  diBgt: BigNumberish;
  dolo: BigNumberish;
  eBtc: BigNumberish;
  henlo: BigNumberish;
  honey: BigNumberish;
  iBera: BigNumberish;
  iBgt: BigNumberish;
  ir: BigNumberish;
  kdk: BigNumberish;
  lbtc: BigNumberish;
  nect: BigNumberish;
  ohm: BigNumberish;
  oriBgt: BigNumberish;
  polRUsd: BigNumberish;
  ptIBgt: BigNumberish;
  pumpBtc: BigNumberish;
  rsEth: BigNumberish;
  rswEth: BigNumberish;
  rUsd: BigNumberish;
  sbtc: BigNumberish;
  sUsda: BigNumberish;
  sUsde: BigNumberish;
  sWbera: BigNumberish;
  sdeUsd: BigNumberish;
  srUsd: BigNumberish;
  stBtc: BigNumberish;
  solvBtc: BigNumberish;
  stone: BigNumberish;
  uniBtc: BigNumberish;
  usd0: BigNumberish;
  usd0pp: BigNumberish;
  usda: BigNumberish;
  usde: BigNumberish;
  usdt: BigNumberish;
  wbera: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  wgBera: BigNumberish;
  xSolvBtc: BigNumberish;
  ylFbtc: BigNumberish;
  ylPumpBtc: BigNumberish;
  ylStEth: BigNumberish;
}

export interface CoreProtocolParamsBerachain {
  berachainRewardsEcosystem: BerachainRewardsEcosystem;
  dTokens: CoreProtocolDolomiteTokensBerachain;
  marketIds: CoreProtocolMarketIdsBerachain;
  chainsightPriceOracleV3: ChainsightPriceOracleV3;
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  oogaBoogaEcosystem: OogaBoogaEcosystem;
  pendleEcosystem: PendleEcosystemBerachain;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokenomics: TokenomicsEcosystem;
  tokenomicsAirdrop: TokenomicsAirdropEcosystem;
  tokens: CoreProtocolTokensBerachain;
}

export class CoreProtocolBerachain extends CoreProtocolAbstract<Network.Berachain> {
  public readonly dolomiteTokens: CoreProtocolDolomiteTokensBerachain;
  public readonly network: Network.Berachain = Network.Berachain;
  public readonly marketIds: CoreProtocolMarketIdsBerachain;
  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly chainsightPriceOracleV3: ChainsightPriceOracleV3;
  public readonly oogaBoogaEcosystem: OogaBoogaEcosystem;
  public readonly pendleEcosystem: PendleEcosystemBerachain;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public readonly tokenomics: TokenomicsEcosystem;
  public readonly tokenomicsAirdrop: TokenomicsAirdropEcosystem;
  public readonly tokens: CoreProtocolTokensBerachain;

  public readonly berachainRewardsEcosystem: BerachainRewardsEcosystem;

  constructor(
    params: CoreProtocolParams<Network.Berachain>,
    berachainParams: CoreProtocolParamsBerachain,
  ) {
    super(params);
    this.berachainRewardsEcosystem = berachainParams.berachainRewardsEcosystem;
    this.oogaBoogaEcosystem = berachainParams.oogaBoogaEcosystem;
    this.chroniclePriceOracleV3 = berachainParams.chroniclePriceOracleV3;
    this.chainsightPriceOracleV3 = berachainParams.chainsightPriceOracleV3;
    this.dolomiteTokens = berachainParams.dTokens;
    this.marketIds = berachainParams.marketIds;
    this.oogaBoogaEcosystem = berachainParams.oogaBoogaEcosystem;
    this.pendleEcosystem = berachainParams.pendleEcosystem;
    this.redstonePriceOracleV3 = berachainParams.redstonePriceOracleV3;
    this.tokenomics = berachainParams.tokenomics;
    this.tokenomicsAirdrop = berachainParams.tokenomicsAirdrop;
    this.tokens = berachainParams.tokens;
  }
}

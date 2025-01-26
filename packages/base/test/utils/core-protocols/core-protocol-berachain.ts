import { ChroniclePriceOracleV3, RedstonePriceOracleV3 } from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumberish } from 'ethers';
import { IERC20, IWETH } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

export interface CoreProtocolTokensBerachain extends CoreProtocolTokens<Network.Berachain> {
  beraEth: IERC20;
  eBtc: IERC20;
  honey: IERC20;
  lbtc: IERC20;
  nect: IERC20;
  pumpBtc: IERC20;
  rsEth: IERC20;
  rswEth: IERC20;
  rUsd: IERC20;
  sbtc: IERC20;
  sUsda: IERC20;
  sUsde: IERC20;
  stBtc: IERC20;
  solvBtc: IERC20;
  solvBtcBbn: IERC20;
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
  ylBtcLst: IERC20;
  ylPumpBtc: IERC20;
  ylStEth: IERC20;
}

interface CoreProtocolMarketIdsBerachain extends CoreProtocolMarketIds {
  beraEth: BigNumberish;
  eBtc: BigNumberish;
  honey: BigNumberish;
  lbtc: BigNumberish;
  nect: BigNumberish;
  pumpBtc: BigNumberish;
  rsEth: BigNumberish;
  rswEth: BigNumberish;
  rUsd: BigNumberish;
  sbtc: BigNumberish;
  sUsda: BigNumberish;
  sUsde: BigNumberish;
  stBtc: BigNumberish;
  solvBtc: BigNumberish;
  solvBtcBbn: BigNumberish;
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
  ylBtcLst: BigNumberish;
  ylPumpBtc: BigNumberish;
  ylStEth: BigNumberish;
}

export interface CoreProtocolParamsBerachain {
  marketIds: CoreProtocolMarketIdsBerachain;
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensBerachain;
}

export class CoreProtocolBerachain extends CoreProtocolAbstract<Network.Berachain> {
  public readonly network: Network.Berachain = Network.Berachain;
  public readonly marketIds: CoreProtocolMarketIdsBerachain;
  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public readonly tokens: CoreProtocolTokensBerachain;

  // public readonly oogaBoogaEcosystem: OogaBoogaEcosystem; // TODO

  constructor(params: CoreProtocolParams<Network.Berachain>, berachainParams: CoreProtocolParamsBerachain) {
    super(params);
    this.marketIds = berachainParams.marketIds;
    this.chroniclePriceOracleV3 = berachainParams.chroniclePriceOracleV3;
    this.redstonePriceOracleV3 = berachainParams.redstonePriceOracleV3;
    this.tokens = berachainParams.tokens;
  }
}

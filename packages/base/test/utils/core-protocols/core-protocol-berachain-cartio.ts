import { BigNumberish } from 'ethers';
import { IERC20, IWETH } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

export interface CoreProtocolTokensBerachainCartio extends CoreProtocolTokens<Network.BerachainCartio> {
  beraETH: IERC20;
  honey: IERC20;
  nect: IERC20;
  pumpBtc: IERC20;
  sbtc: IERC20;
  solvBtc: IERC20;
  solvBtcBbn: IERC20;
  stBtc: IERC20;
  stone: IERC20;
  stoneBtc: IERC20;
  susda: IERC20;
  uniBtc: IERC20;
  usda: IERC20;
  usde: IERC20;
  usdt: IERC20;
  wbera: IWETH;
  wbtc: IERC20;
  ylBtcLst: IERC20;
  ylFbtc: IERC20;
  ylPumpBtc: IERC20;
  ylStEth: IERC20;
  ylUniBtc: IERC20;
}

interface CoreProtocolMarketIdsBerachainCartio extends CoreProtocolMarketIds {
  beraETH: BigNumberish;
  honey: BigNumberish;
  nect: BigNumberish;
  pumpBtc: BigNumberish;
  sbtc: BigNumberish;
  solvBtc: BigNumberish;
  solvBtcBbn: BigNumberish;
  stBtc: BigNumberish;
  stone: BigNumberish;
  stoneBtc: BigNumberish;
  susda: BigNumberish;
  uniBtc: BigNumberish;
  usda: BigNumberish;
  usde: BigNumberish;
  usdt: BigNumberish;
  wbera: BigNumberish;
  wbtc: BigNumberish;
  ylBtcLst: BigNumberish;
  ylFbtc: BigNumberish;
  ylPumpBtc: BigNumberish;
  ylStEth: BigNumberish;
  ylUniBtc: BigNumberish;
}

export interface CoreProtocolParamsBerachainCartio {
  marketIds: CoreProtocolMarketIdsBerachainCartio;
  tokens: CoreProtocolTokensBerachainCartio;
}

export class CoreProtocolBerachainCartio extends CoreProtocolAbstract<Network.BerachainCartio> {
  public readonly network: Network.BerachainCartio = Network.BerachainCartio;
  public readonly marketIds: CoreProtocolMarketIdsBerachainCartio;
  public readonly tokens: CoreProtocolTokensBerachainCartio;

  constructor(params: CoreProtocolParams<Network.BerachainCartio>, berachainParams: CoreProtocolParamsBerachainCartio) {
    super(params);
    this.marketIds = berachainParams.marketIds;
    this.tokens = berachainParams.tokens;
  }
}

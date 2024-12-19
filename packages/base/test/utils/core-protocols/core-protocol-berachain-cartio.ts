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
  honey: IERC20;
  sbtc: IERC20;
  stone: IERC20;
  stoneBtc: IERC20;
  uniBtc: IERC20;
  usdt: IERC20;
  wbera: IWETH;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsBerachainCartio extends CoreProtocolMarketIds {
  honey: BigNumberish;
  sbtc: BigNumberish;
  stone: BigNumberish;
  stoneBtc: BigNumberish;
  uniBtc: BigNumberish;
  usdt: BigNumberish;
  wbera: BigNumberish;
  wbtc: BigNumberish;
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

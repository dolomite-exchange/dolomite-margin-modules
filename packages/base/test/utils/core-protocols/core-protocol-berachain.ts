import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';
import { IERC20, IWETH } from '../../../src/types';
import { BigNumberish } from 'ethers';
import { RedstonePriceOracleV3 } from '@dolomite-exchange/modules-oracles/src/types';

export interface CoreProtocolTokensBerachain extends CoreProtocolTokens<Network.Berachain> {
  honey: IERC20;
  wbera: IWETH;
}

interface CoreProtocolMarketIdsBerachain extends CoreProtocolMarketIds {
  honey: BigNumberish;
  wbera: BigNumberish;
}

export interface CoreProtocolParamsBerachain {
  marketIds: CoreProtocolMarketIdsBerachain;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensBerachain;
}

export class CoreProtocolBerachain extends CoreProtocolAbstract<Network.Berachain> {

  public readonly network: Network.Berachain = Network.Berachain;
  public readonly marketIds: CoreProtocolMarketIdsBerachain;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public readonly tokens: CoreProtocolTokensBerachain;

  constructor(
    params: CoreProtocolParams<Network.Berachain>,
    berachainParams: CoreProtocolParamsBerachain,
  ) {
    super(params);
    this.marketIds = berachainParams.marketIds;
    this.redstonePriceOracleV3 = berachainParams.redstonePriceOracleV3;
    this.tokens = berachainParams.tokens;
  }
}
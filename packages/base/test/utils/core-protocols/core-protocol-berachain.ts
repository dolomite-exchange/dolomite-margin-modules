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
import { OogaBoogaEcosystem } from '../ecosystem-utils/ooga-booga';
import { IBGT } from 'packages/berachain/src/types';
import { BerachainRewardsEcosystem } from '../ecosystem-utils/berachain-rewards';

export interface CoreProtocolTokensBerachain extends CoreProtocolTokens<Network.Berachain> {
  honey: IERC20;
  wbera: IWETH;
  bgt: IBGT;
  ibgt: IERC20;
}

interface CoreProtocolMarketIdsBerachain extends CoreProtocolMarketIds {
  honey: BigNumberish;
  wbera: BigNumberish;
}

export interface CoreProtocolParamsBerachain {
  marketIds: CoreProtocolMarketIdsBerachain;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensBerachain;
  oogaBoogaEcosystem: OogaBoogaEcosystem;
  berachainRewardsEcosystem: BerachainRewardsEcosystem;
}

export class CoreProtocolBerachain extends CoreProtocolAbstract<Network.Berachain> {

  public readonly network: Network.Berachain = Network.Berachain;
  public readonly marketIds: CoreProtocolMarketIdsBerachain;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public readonly tokens: CoreProtocolTokensBerachain;

  public readonly berachainRewardsEcosystem: BerachainRewardsEcosystem;
  public readonly oogaBoogaEcosystem: OogaBoogaEcosystem;

  constructor(
    params: CoreProtocolParams<Network.Berachain>,
    berachainParams: CoreProtocolParamsBerachain,
  ) {
    super(params);
    this.marketIds = berachainParams.marketIds;
    this.redstonePriceOracleV3 = berachainParams.redstonePriceOracleV3;
    this.tokens = berachainParams.tokens;
    this.berachainRewardsEcosystem = berachainParams.berachainRewardsEcosystem;
    this.oogaBoogaEcosystem = berachainParams.oogaBoogaEcosystem;
  }
}

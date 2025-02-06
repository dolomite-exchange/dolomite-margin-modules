import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';
import { IERC20, IWETH } from '../../../src/types';
import { BigNumberish } from 'ethers';
import { ChroniclePriceOracleV3, RedstonePriceOracleV3 } from '@dolomite-exchange/modules-oracles/src/types';
import { OogaBoogaEcosystem } from '../ecosystem-utils/ooga-booga';
import { IBGT } from 'packages/berachain/src/types';

export interface CoreProtocolTokensBerachainBartio extends CoreProtocolTokens<Network.BerachainBartio> {
  honey: IERC20;
  sbtc: IERC20;
  stoneBtc: IERC20;
  uniBtc: IERC20;
  wbera: IWETH;
}

interface CoreProtocolMarketIdsBerachainBartio extends CoreProtocolMarketIds {
  honey: BigNumberish;
  wbera: BigNumberish;
}

export interface CoreProtocolParamsBerachain {
  marketIds: CoreProtocolMarketIdsBerachainBartio;
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensBerachainBartio;
  oogaBoogaEcosystem: OogaBoogaEcosystem;
}

export class CoreProtocolBerachainBartio extends CoreProtocolAbstract<Network.BerachainBartio> {

  public readonly network: Network.BerachainBartio = Network.BerachainBartio;
  public readonly marketIds: CoreProtocolMarketIdsBerachainBartio;
  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public readonly tokens: CoreProtocolTokensBerachainBartio;

  public readonly oogaBoogaEcosystem: OogaBoogaEcosystem;

  constructor(
    params: CoreProtocolParams<Network.BerachainBartio>,
    berachainParams: CoreProtocolParamsBerachain,
  ) {
    super(params);
    this.marketIds = berachainParams.marketIds;
    this.chroniclePriceOracleV3 = berachainParams.chroniclePriceOracleV3;
    this.redstonePriceOracleV3 = berachainParams.redstonePriceOracleV3;
    this.tokens = berachainParams.tokens;
    this.oogaBoogaEcosystem = berachainParams.oogaBoogaEcosystem;
  }
}

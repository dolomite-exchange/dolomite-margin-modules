import { BigNumberish } from 'ethers';
import { ChroniclePriceOracleV3, RedstonePriceOracleV3 } from 'packages/oracles/src/types';
import { IERC20, IWETH } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

export interface CoreProtocolTokensMantle extends CoreProtocolTokens<Network.Mantle> {
  wmnt: IWETH;
  meth: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsMantle extends CoreProtocolMarketIds {
  wmnt: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsMantle {
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  marketIds: CoreProtocolMarketIdsMantle;
  odosEcosystem: OdosEcosystem;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensMantle;
}

export class CoreProtocolMantle extends CoreProtocolAbstract<Network.Mantle> {

  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public override readonly marketIds: CoreProtocolMarketIdsMantle;
  public override readonly tokens: CoreProtocolTokensMantle;
  public readonly network: Network.Mantle = Network.Mantle;

  public readonly odosEcosystem: OdosEcosystem;

  constructor(
    params: CoreProtocolParams<Network.Mantle>,
    mantleParams: CoreProtocolParamsMantle,
  ) {
    super(params);
    this.marketIds = mantleParams.marketIds;
    this.tokens = mantleParams.tokens;

    this.chroniclePriceOracleV3 = mantleParams.chroniclePriceOracleV3;
    this.odosEcosystem = mantleParams.odosEcosystem;
    this.redstonePriceOracleV3 = mantleParams.redstonePriceOracleV3;
  }
}
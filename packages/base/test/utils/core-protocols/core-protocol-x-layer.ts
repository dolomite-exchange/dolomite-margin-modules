import { BigNumberish } from 'ethers';
import { OkxPriceOracleV3 } from 'packages/oracles/src/types';
import { IERC20, IWETH } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { LiquidityMiningEcosystemXLayer, MineralLiquidityMiningEcosystem } from '../ecosystem-utils/liquidity-mining';
import { OkxEcosystem } from '../ecosystem-utils/okx';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensXLayer extends CoreProtocolTokens<Network.XLayer> {
  wokb: IWETH;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsXLayer extends CoreProtocolMarketIds {
  wokb: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsXLayer {
  marketIds: CoreProtocolMarketIdsXLayer;
  liquidityMiningEcosystem: LiquidityMiningEcosystemXLayer;
  okxEcosystem: OkxEcosystem;
  okxPriceOracleV3: OkxPriceOracleV3;
  tokens: CoreProtocolTokensXLayer;
}

export class CoreProtocolXLayer extends CoreProtocolAbstract<Network.XLayer> {

  public readonly liquidityMiningEcosystem: LiquidityMiningEcosystemXLayer;
  public readonly okxEcosystem: OkxEcosystem;
  public readonly okxPriceOracleV3: OkxPriceOracleV3;

  public override readonly marketIds: CoreProtocolMarketIdsXLayer;
  public override readonly tokens: CoreProtocolTokensXLayer;
  public readonly network: Network.XLayer = Network.XLayer;

  constructor(
    params: CoreProtocolParams<Network.XLayer>,
    xLayerParams: CoreProtocolParamsXLayer,
  ) {
    super(params);
    this.marketIds = xLayerParams.marketIds;
    this.liquidityMiningEcosystem = xLayerParams.liquidityMiningEcosystem;
    this.okxEcosystem = xLayerParams.okxEcosystem;
    this.okxPriceOracleV3 = xLayerParams.okxPriceOracleV3;
    this.tokens = xLayerParams.tokens;
  }
}

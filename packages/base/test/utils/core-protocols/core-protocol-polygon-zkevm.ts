import { BigNumberish } from 'ethers';
import { IERC20 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { ParaswapEcosystem } from '../ecosystem-utils/paraswap';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensPolygonZkEvm extends CoreProtocolTokens<Network.PolygonZkEvm> {
  dai: IERC20;
  link: IERC20;
  matic: IERC20;
  pol: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
}

interface CoreProtocolMarketIdsPolygonZkEvm extends CoreProtocolMarketIds {
  dai: BigNumberish;
  link: BigNumberish;
  matic: BigNumberish;
  pol: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
}

export interface CoreProtocolParamsPolygonZkEvm {
  marketIds: CoreProtocolMarketIdsPolygonZkEvm;
  paraswapEcosystem: ParaswapEcosystem;
  tokens: CoreProtocolTokensPolygonZkEvm;
}

export class CoreProtocolPolygonZkEvm extends CoreProtocolAbstract<Network.PolygonZkEvm> {

  public override readonly marketIds: CoreProtocolMarketIdsPolygonZkEvm;
  public override readonly tokens: CoreProtocolTokensPolygonZkEvm;
  public readonly network: Network.PolygonZkEvm = Network.PolygonZkEvm;

  public readonly paraswapEcosystem: ParaswapEcosystem;

  constructor(
    params: CoreProtocolParams<Network.PolygonZkEvm>,
    zkEvmParams: CoreProtocolParamsPolygonZkEvm,
  ) {
    super(params);
    this.marketIds = zkEvmParams.marketIds;
    this.tokens = zkEvmParams.tokens;

    this.paraswapEcosystem = zkEvmParams.paraswapEcosystem;
  }
}

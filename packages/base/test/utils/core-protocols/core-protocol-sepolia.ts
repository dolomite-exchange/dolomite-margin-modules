import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensSepolia extends CoreProtocolTokens<Network.Sepolia> {
}

interface CoreProtocolMarketIdsSepolia extends CoreProtocolMarketIds {
}

export interface CoreProtocolParamsSepolia {
  marketIds: CoreProtocolMarketIdsSepolia;
  tokens: CoreProtocolTokensSepolia;
}

export class CoreProtocolSepolia extends CoreProtocolAbstract<Network.Sepolia> {
  public override readonly marketIds: CoreProtocolMarketIdsSepolia;
  public readonly network: Network.Sepolia = Network.Sepolia;
  public override readonly tokens: CoreProtocolTokensSepolia;

  constructor(params: CoreProtocolParams<Network.Sepolia>, ethereumParams: CoreProtocolParamsSepolia) {
    super(params);
    this.marketIds = ethereumParams.marketIds;
    this.tokens = ethereumParams.tokens;
  }
}

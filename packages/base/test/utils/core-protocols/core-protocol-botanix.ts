import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';
import { IERC20, IWETH } from '../../../src/types';
import { BigNumberish } from 'ethers';
import { OogaBoogaEcosystem } from '../ecosystem-utils/ooga-booga';

interface CoreProtocolTokensBotanix extends CoreProtocolTokens<Network.Botanix> {
  pbtc: IWETH;
  stBtc: IERC20;
  usdt: IERC20;
}

interface CoreProtocolMarketIdsBotanix extends CoreProtocolMarketIds {
  pbtc: BigNumberish;
  stBtc: BigNumberish;
  usdt: BigNumberish;
}

export interface CoreProtocolParamsBotanix {
  marketIds: CoreProtocolMarketIdsBotanix;
  oogaBoogaEcosystem: OogaBoogaEcosystem;
  tokens: CoreProtocolTokensBotanix;
}

export class CoreProtocolBotanix extends CoreProtocolAbstract<Network.Botanix> {
  public override readonly marketIds: CoreProtocolMarketIdsBotanix;
  public readonly network: Network.Botanix = Network.Botanix;
  public readonly oogaBoogaEcosystem: OogaBoogaEcosystem;
  public override readonly tokens: CoreProtocolTokensBotanix;

  constructor(params: CoreProtocolParams<Network.Botanix>, botanixParams: CoreProtocolParamsBotanix) {
    super(params);
    this.marketIds = botanixParams.marketIds;
    this.oogaBoogaEcosystem = botanixParams.oogaBoogaEcosystem;
    this.tokens = botanixParams.tokens;
  }
}

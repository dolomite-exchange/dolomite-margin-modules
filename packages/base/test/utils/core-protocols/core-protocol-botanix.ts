import { Network } from '../../../src/utils/no-deps-constants';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';
import { IERC20 } from '../../../src/types';
import { BigNumberish } from 'ethers';

interface CoreProtocolTokensBotanix extends CoreProtocolTokens<Network.Botanix> {
  pbtc: IERC20;
  pUsd: IERC20;
  stBtc: IERC20;
  usdt: IERC20;
  ypUsd: IERC20;
}

interface CoreProtocolMarketIdsBotanix extends CoreProtocolMarketIds {
  pbtc: BigNumberish;
  pUsd: BigNumberish;
  stBtc: BigNumberish;
  usdt: BigNumberish;
  ypUsd: BigNumberish;
}

export interface CoreProtocolParamsBotanix {
  marketIds: CoreProtocolMarketIdsBotanix;
  tokens: CoreProtocolTokensBotanix;
}

export class CoreProtocolBotanix extends CoreProtocolAbstract<Network.Botanix> {
  public override readonly marketIds: CoreProtocolMarketIdsBotanix;
  public readonly network: Network.Botanix = Network.Botanix;
  public override readonly tokens: CoreProtocolTokensBotanix;

  constructor(params: CoreProtocolParams<Network.Botanix>, botanixParams: CoreProtocolParamsBotanix) {
    super(params);
    this.marketIds = botanixParams.marketIds;
    this.tokens = botanixParams.tokens;
  }
}

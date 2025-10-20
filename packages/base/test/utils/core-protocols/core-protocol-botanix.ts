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

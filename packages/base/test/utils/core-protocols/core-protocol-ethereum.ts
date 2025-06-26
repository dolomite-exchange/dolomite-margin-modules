import { BigNumberish } from 'ethers';
import { IERC20 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensEthereum extends CoreProtocolTokens<Network.Ethereum> {
  aave: IERC20;
  crv: IERC20;
  link: IERC20;
  rUsd: IERC20;
  srUsd: IERC20;
  sUsde: IERC20;
  usd1: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
  weEth: IERC20;
  wstEth: IERC20;
}

interface CoreProtocolMarketIdsEthereum extends CoreProtocolMarketIds {
  aave: BigNumberish;
  crv: BigNumberish;
  link: BigNumberish;
  rUsd: BigNumberish;
  srUsd: BigNumberish;
  sUsde: BigNumberish;
  usd1: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  wstEth: BigNumberish;
}

export interface CoreProtocolParamsEthereum {
  marketIds: CoreProtocolMarketIdsEthereum;
  odosEcosystem: OdosEcosystem;
  tokens: CoreProtocolTokensEthereum;
}

export class CoreProtocolEthereum extends CoreProtocolAbstract<Network.Ethereum> {
  public readonly odosEcosystem: OdosEcosystem;
  public override readonly marketIds: CoreProtocolMarketIdsEthereum;
  public readonly network: Network.Ethereum = Network.Ethereum;
  public override readonly tokens: CoreProtocolTokensEthereum;

  constructor(params: CoreProtocolParams<Network.Ethereum>, ethereumParams: CoreProtocolParamsEthereum) {
    super(params);
    this.marketIds = ethereumParams.marketIds;
    this.odosEcosystem = ethereumParams.odosEcosystem;
    this.tokens = ethereumParams.tokens;
  }
}

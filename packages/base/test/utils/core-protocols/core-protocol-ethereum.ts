import {
  ChroniclePriceOracleV3,
  ERC4626PriceOracle,
  RedstonePriceOracleV3,
} from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumberish } from 'ethers';
import { IERC20 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { EnsoEcosystem } from '../ecosystem-utils/enso';
import { OdosEcosystem } from '../ecosystem-utils/odos';
import {
  CoreProtocolAbstract,
  CoreProtocolMarketIds,
  CoreProtocolParams,
  CoreProtocolTokens,
} from './core-protocol-abstract';

interface CoreProtocolTokensEthereum extends CoreProtocolTokens<Network.Ethereum> {
  aave: IERC20;
  cUsd: IERC20;
  crv: IERC20;
  dolo: IERC20;
  link: IERC20;
  mEth: IERC20;
  rUsd: IERC20;
  srUsd: IERC20;
  stcUsd: IERC20;
  sUsde: IERC20;
  usd1: IERC20;
  usdt: IERC20;
  wbtc: IERC20;
  weEth: IERC20;
  wlfi: IERC20;
  wstEth: IERC20;
}

interface CoreProtocolMarketIdsEthereum extends CoreProtocolMarketIds {
  aave: BigNumberish;
  cUsd: BigNumberish;
  crv: BigNumberish;
  dolo: BigNumberish;
  link: BigNumberish;
  mEth: BigNumberish;
  rUsd: BigNumberish;
  srUsd: BigNumberish;
  stcUsd: BigNumberish;
  sUsde: BigNumberish;
  usd1: BigNumberish;
  usdt: BigNumberish;
  wbtc: BigNumberish;
  weEth: BigNumberish;
  wlfi: BigNumberish;
  wstEth: BigNumberish;
}

export interface CoreProtocolParamsEthereum {
  chroniclePriceOracleV3: ChroniclePriceOracleV3;
  ensoEcosystem: EnsoEcosystem;
  erc4626Oracle: ERC4626PriceOracle;
  marketIds: CoreProtocolMarketIdsEthereum;
  odosEcosystem: OdosEcosystem;
  redstonePriceOracleV3: RedstonePriceOracleV3;
  tokens: CoreProtocolTokensEthereum;
}

export class CoreProtocolEthereum extends CoreProtocolAbstract<Network.Ethereum> {
  public readonly chroniclePriceOracleV3: ChroniclePriceOracleV3;
  public readonly ensoEcosystem: EnsoEcosystem;
  public readonly erc4626Oracle: ERC4626PriceOracle;
  public readonly odosEcosystem: OdosEcosystem;
  public readonly redstonePriceOracleV3: RedstonePriceOracleV3;
  public override readonly marketIds: CoreProtocolMarketIdsEthereum;
  public readonly network: Network.Ethereum = Network.Ethereum;
  public override readonly tokens: CoreProtocolTokensEthereum;

  constructor(params: CoreProtocolParams<Network.Ethereum>, ethereumParams: CoreProtocolParamsEthereum) {
    super(params);
    this.chroniclePriceOracleV3 = ethereumParams.chroniclePriceOracleV3;
    this.ensoEcosystem = ethereumParams.ensoEcosystem;
    this.erc4626Oracle = ethereumParams.erc4626Oracle;
    this.marketIds = ethereumParams.marketIds;
    this.odosEcosystem = ethereumParams.odosEcosystem;
    this.redstonePriceOracleV3 = ethereumParams.redstonePriceOracleV3;
    this.tokens = ethereumParams.tokens;
  }
}

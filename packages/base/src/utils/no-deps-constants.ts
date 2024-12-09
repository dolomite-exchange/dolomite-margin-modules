import { BigNumber } from 'ethers';
import { GenericTraderParamStruct } from './index';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
  Base = '8453',
  Berachain = '80084',
  BerachainCartio = '80000',
  Mantle = '5000',
  PolygonZkEvm = '1101',
  XLayer = '196',
}

export type NetworkType =
  Network.ArbitrumOne
  | Network.Base
  | Network.Berachain
  | Network.Mantle
  | Network.PolygonZkEvm
  | Network.XLayer;

export enum NetworkName {
  ArbitrumOne = 'arbitrum_one',
  Base = 'base',
  Berachain = 'berachain',
  BerachainCartio = 'berachain_cartio',
  Mantle = 'mantle',
  PolygonZkEvm = 'polygon_zkevm',
  XLayer = 'x_layer',
}

export const NETWORK_TO_NETWORK_NAME_MAP: Record<Network, NetworkName> = {
  [Network.ArbitrumOne]: NetworkName.ArbitrumOne,
  [Network.Base]: NetworkName.Base,
  [Network.Berachain]: NetworkName.Berachain,
  [Network.BerachainCartio]: NetworkName.BerachainCartio,
  [Network.Mantle]: NetworkName.Mantle,
  [Network.PolygonZkEvm]: NetworkName.PolygonZkEvm,
  [Network.XLayer]: NetworkName.XLayer,
};

const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
export const NETWORK_ID: Network = Network[typedNetworkIdString as keyof typeof Network] || Network.ArbitrumOne;

export const NO_EXPIRY = BigNumber.from('0');

export const NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP: Record<Network, number> = {
  [Network.ArbitrumOne]: 221_467_300,
  [Network.Base]: 10_050_058,
  [Network.Berachain]: 1_708_014,
  [Network.BerachainCartio]: 10_000,
  [Network.Mantle]: 66_804_500,
  [Network.PolygonZkEvm]: 9_860_500,
  [Network.XLayer]: 854_000,
};

export const DEFAULT_BLOCK_NUMBER = NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[NETWORK_ID];

export const ONE_DAY_SECONDS = 86_400;

export const ONE_WEEK_SECONDS = 604_800;

export const BYTES_EMPTY = '0x';
export const BYTES_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const ZERO_BI = BigNumber.from('0');

export const ONE_BI = BigNumber.from('1');

export const TWO_BI = BigNumber.from('2');

export const ONE_ETH_BI = BigNumber.from('1000000000000000000');

export const TEN_BI = BigNumber.from('10');

export const MAX_INT_192_BI = BigNumber.from('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
export const MAX_UINT_256_BI = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export const LIQUIDATE_ALL = MAX_UINT_256_BI;

export const SELL_ALL = MAX_UINT_256_BI;

export const NO_PARASWAP_TRADER_PARAM: GenericTraderParamStruct | undefined = undefined;

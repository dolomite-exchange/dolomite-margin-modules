import { BigNumber } from 'ethers';
import { GenericTraderParamStruct } from './index';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
  Base = '8453',
  Berachain = '80094',
  Ink = '57073',
  Mantle = '5000',
  PolygonZkEvm = '1101',
  SuperSeed = '5330',
  XLayer = '196',
}

export type NetworkTypeForDolomiteV2 =
  Network.Base
  | Network.Berachain
  | Network.Ink
  | Network.Mantle
  | Network.PolygonZkEvm
  | Network.SuperSeed
  | Network.XLayer;

export type NetworkType = Network.ArbitrumOne | NetworkTypeForDolomiteV2;

export enum NetworkName {
  ArbitrumOne = 'arbitrum_one',
  Base = 'base',
  Berachain = 'berachain',
  Ink = 'ink',
  Mantle = 'mantle',
  PolygonZkEvm = 'polygon_zkevm',
  SuperSeed = 'super_seed',
  XLayer = 'x_layer',
}

export const NETWORK_TO_NETWORK_NAME_MAP: Record<Network, NetworkName> = {
  [Network.ArbitrumOne]: NetworkName.ArbitrumOne,
  [Network.Base]: NetworkName.Base,
  [Network.Berachain]: NetworkName.Berachain,
  [Network.Ink]: NetworkName.Ink,
  [Network.Mantle]: NetworkName.Mantle,
  [Network.PolygonZkEvm]: NetworkName.PolygonZkEvm,
  [Network.SuperSeed]: NetworkName.SuperSeed,
  [Network.XLayer]: NetworkName.XLayer,
};

/**
 * Generated via `safe_hashes --list-networks`
 */
export const NETWORK_TO_SAFE_HASH_NAME_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: 'arbitrum',
  [Network.Base]: 'base',
  [Network.Berachain]: 'berachain',
  [Network.Ink]: undefined,
  [Network.Mantle]: 'mantle',
  [Network.PolygonZkEvm]: 'polygon-zkevm',
  [Network.SuperSeed]: undefined,
  [Network.XLayer]: 'xlayer',
};

export const NETWORK_TO_MULTI_SEND_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Base]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Berachain]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Ink]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Mantle]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.PolygonZkEvm]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.SuperSeed]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.XLayer]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
};

const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
export const NETWORK_ID: Network = Network[typedNetworkIdString as keyof typeof Network] || Network.ArbitrumOne;

export const NO_EXPIRY = BigNumber.from('0');

export const NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP: Record<Network, number> = {
  [Network.ArbitrumOne]: 221_467_300,
  [Network.Base]: 10_050_058,
  [Network.Berachain]: 160822,
  [Network.Ink]: 0,
  [Network.Mantle]: 66_804_500,
  [Network.PolygonZkEvm]: 9_860_500,
  [Network.SuperSeed]: 0,
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

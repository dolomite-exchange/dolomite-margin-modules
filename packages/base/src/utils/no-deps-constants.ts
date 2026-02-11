import { BigNumber } from 'ethers';
import { GenericTraderParamStruct } from './index';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
  Base = '8453',
  Berachain = '80094',
  Bnb = '56',
  Botanix = '3637',
  Ethereum = '1',
  Ink = '57073',
  Mantle = '5000',
  PolygonZkEvm = '1101',
  SuperSeed = '5330',
  XLayer = '196',
}

export type DolomiteV2Network =
  | Network.Base
  | Network.Berachain
  | Network.Bnb
  | Network.Botanix
  | Network.Ethereum
  | Network.Ink
  | Network.Mantle
  | Network.PolygonZkEvm
  | Network.SuperSeed
  | Network.XLayer;

export type DolomiteNetwork = Network.ArbitrumOne | DolomiteV2Network;

export type DolomiteNetworkNoBotanixOrEthereum = Exclude<DolomiteNetwork, Network.Botanix | Network.Ethereum>;

export enum NetworkName {
  ArbitrumOne = 'arbitrum_one',
  Base = 'base',
  Berachain = 'berachain',
  Bnb = 'bnb',
  Botanix = 'botanix',
  Ethereum = 'ethereum',
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
  [Network.Bnb]: NetworkName.Bnb,
  [Network.Botanix]: NetworkName.Botanix,
  [Network.Ethereum]: NetworkName.Ethereum,
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
  [Network.Bnb]: 'bnb',
  [Network.Botanix]: undefined,
  [Network.Ethereum]: 'ethereum',
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
  [Network.Bnb]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Botanix]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
  [Network.Ethereum]: '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B',
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
  [Network.Bnb]: 0, // TODO:
  [Network.Botanix]: 0, // TODO:
  [Network.Ethereum]: 22_308_000, // TODO:
  [Network.Ink]: 0, // TODO:
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

export const EVM_VERSION = 'london';

// ========================================
// ================= Roles ================
// ========================================

export const ADMIN_CLAIM_EXCESS_TOKENS_ROLE = '0xebeb1fd66be1e1671e89346bde616d3c80a23c8200e82898d23f4769ae075f75';
export const ADMIN_PAUSE_MARKET_ROLE = '0xb74ffa3c06e003b9396a9563087dd5e1f06cf2c92548550a731a01f76c77545f';
export const BYPASS_TIMELOCK_ROLE = '0x21bee6ac0139693d77752bbffb07a6fab05816a10c9d8daed537913d19d5e921';
export const D_TOKEN_ROLE = '0xcd86ded6d567eb7adb1b98d283b7e4004869021f7651dbae982e0992bfe0df5a';
export const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const EXECUTOR_ROLE = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';

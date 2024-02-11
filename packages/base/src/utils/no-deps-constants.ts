import { BigNumber } from 'ethers';
import { GenericTraderParamStruct } from './index';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
  Base = '8453',
  PolygonZkEvm = '1101',
}

export type NetworkType = Network.ArbitrumOne | Network.Base | Network.PolygonZkEvm;

export enum NetworkName {
  ArbitrumOne = 'arbitrum_one',
  Base = 'base',
  PolygonZkEvm = 'polygon_zkevm',
}

export const networkToNetworkNameMap: Record<Network, NetworkName> = {
  [Network.ArbitrumOne]: NetworkName.ArbitrumOne,
  [Network.Base]: NetworkName.Base,
  [Network.PolygonZkEvm]: NetworkName.PolygonZkEvm,
};

const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
export const NETWORK_ID: Network = Network[typedNetworkIdString as keyof typeof Network] || Network.ArbitrumOne;

export const NO_EXPIRY = BigNumber.from('0');

export const NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP: Record<Network, number> = {
  [Network.ArbitrumOne]: 167_300_000,
  [Network.Base]: 10_050_058,
  [Network.PolygonZkEvm]: 9_856_300,
};

export const DEFAULT_BLOCK_NUMBER = NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[NETWORK_ID];

export const ONE_DAY_SECONDS = 86_400;

export const ONE_WEEK_SECONDS = 604_800;

export const BYTES_EMPTY = '0x';
export const BYTES_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const ZERO_BI = BigNumber.from('0');

export const ONE_BI = BigNumber.from('1');

export const ONE_ETH_BI = BigNumber.from('1000000000000000000');

export const TEN_BI = BigNumber.from('10');

export const MAX_INT_192_BI = BigNumber.from('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
export const MAX_UINT_256_BI = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export const LIQUIDATE_ALL = MAX_UINT_256_BI;

export const SELL_ALL = MAX_UINT_256_BI;

export const NO_PARASWAP_TRADER_PARAM: GenericTraderParamStruct | undefined = undefined;

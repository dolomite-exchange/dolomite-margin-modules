import { BigNumber, ethers } from 'ethers';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
  ArbitrumGoerli = '421613',
}

export enum NetworkName {
  ArbitrumOne = 'arbitrum_one',
  ArbitrumGoerli = 'arbitrum_goerli',
}

export const networkToNetworkNameMap: Record<Network, NetworkName> = {
  [Network.ArbitrumOne]: NetworkName.ArbitrumOne,
  [Network.ArbitrumGoerli]: NetworkName.ArbitrumGoerli,
};

const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
export const NETWORK_ID: Network = Network[typedNetworkIdString as keyof typeof Network] || Network.ArbitrumOne;

export const NO_EXPIRY = BigNumber.from('0');

export const NONE_MARKET_ID = ethers.constants.MaxUint256;

const BLOCK_NUMBERS: Record<Network, number> = {
  [Network.ArbitrumOne]: 44452100,
  [Network.ArbitrumGoerli]: 14700000,
};

export const DEFAULT_BLOCK_NUMBER = BLOCK_NUMBERS[NETWORK_ID];

export const ONE_WEEK_SECONDS = 604800;

export const BYTES_EMPTY = '0x';

export const ZERO_BI = BigNumber.from('0');

export const ONE_BI = BigNumber.from('1');

export const MAX_UINT_256_BI = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export const LIQUIDATE_ALL = MAX_UINT_256_BI;

export const SELL_ALL = MAX_UINT_256_BI;

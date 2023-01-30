import { BigNumber } from 'ethers';

// ************************* General Constants *************************

export enum Network {
  ArbitrumOne = '42161',
}

const typedNetworkIdString = process.env.NETWORK_ID || Network.ArbitrumOne;
export const NETWORK_ID: Network = Network[typedNetworkIdString as keyof typeof Network] || Network.ArbitrumOne;

export const NO_EXPIRY = BigNumber.from('0');

const BLOCK_NUMBERS: Record<Network, number> = {
  [Network.ArbitrumOne]: 44452100,
};

export const DEFAULT_BLOCK_NUMBER = BLOCK_NUMBERS[NETWORK_ID];

export const ONE_WEEK_SECONDS = 604800;

export const BYTES_EMPTY = '0x';

export const ZERO_BI = BigNumber.from('0');

export const ONE_BI = BigNumber.from('1');

export const MAX_UINT_256_BI = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

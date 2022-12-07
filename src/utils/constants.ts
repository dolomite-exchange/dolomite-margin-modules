import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as LiquidatorProxyV2WithExternalLiquidityJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import { BaseContract, BigNumberish } from 'ethers';
import {
  ERC20,
  ERC20__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IWETH,
  IWETH__factory,
  LiquidatorProxyV2WithExternalLiquidity,
  LiquidatorProxyV2WithExternalLiquidity__factory,
} from '../types';
import { Network, NETWORK_ID } from './no-deps-constants';

export interface AccountStruct {
  owner: string,
  number: BigNumberish
}

// ************************* External Contract Addresses *************************

interface TokenWithMarketId {
  address: string;
  marketId: number;
}

const USDC_MAP: Record<string, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    marketId: 2,
  },
};

export const USDC = new BaseContract(
  USDC_MAP[NETWORK_ID].address,
  ERC20__factory.createInterface(),
) as ERC20;

export const USDC_MARKET_ID = USDC_MAP[NETWORK_ID].marketId;

const WETH_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    marketId: 0,
  },
};

export const WETH = new BaseContract(
  WETH_MAP[NETWORK_ID].address,
  IWETH__factory.createInterface(),
) as IWETH;

export const WETH_MARKET_ID = WETH_MAP[NETWORK_ID].marketId;

// ************************* Network Addresses *************************

export const DOLOMITE_AMM_FACTORY = new BaseContract(
  DolomiteAmmFactoryJson.networks[NETWORK_ID].address,
  IDolomiteAmmFactory__factory.createInterface(),
) as IDolomiteAmmFactory;

export const DOLOMITE_AMM_ROUTER = new BaseContract(
  DolomiteAmmRouterProxyJson.networks[NETWORK_ID].address,
  IDolomiteAmmRouterProxy__factory.createInterface(),
) as IDolomiteAmmRouterProxy;

export const DOLOMITE_MARGIN = new BaseContract(
  DolomiteMarginJson.networks[NETWORK_ID].address,
  IDolomiteMargin__factory.createInterface(),
) as IDolomiteMargin;

export const LIQUIDATOR_PROXY_V2 = new BaseContract(
  LiquidatorProxyV2WithExternalLiquidityJson.networks[NETWORK_ID].address,
  LiquidatorProxyV2WithExternalLiquidity__factory.createInterface(),
) as LiquidatorProxyV2WithExternalLiquidity;

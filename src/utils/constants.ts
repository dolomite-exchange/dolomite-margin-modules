import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as LiquidatorProxyV2WithExternalLiquidityJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import { BaseContract, BigNumberish } from 'ethers';
import {
  BorrowPositionProxyV2,
  BorrowPositionProxyV2__factory,
  ERC20,
  ERC20__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IERC20,
  IERC20__factory, IExpiry, IExpiry__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardRouterV2,
  IGLPRewardRouterV2__factory,
  IGMXVault,
  IGMXVault__factory, IVGlp, IVGlp__factory,
  IWETH,
  IWETH__factory,
  LiquidatorProxyV2WithExternalLiquidity,
  LiquidatorProxyV2WithExternalLiquidity__factory,
} from '../types';
import { Network, NETWORK_ID } from './no-deps-constants';

export interface AccountStruct {
  owner: string;
  number: BigNumberish;
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

// ************************* Protocol Addresses *************************

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

export const EXPIRY = new BaseContract(
  ExpiryJson.networks[NETWORK_ID].address,
  IExpiry__factory.createInterface(),
) as IExpiry;

export const LIQUIDATOR_PROXY_V2 = new BaseContract(
  LiquidatorProxyV2WithExternalLiquidityJson.networks[NETWORK_ID].address,
  LiquidatorProxyV2WithExternalLiquidity__factory.createInterface(),
) as LiquidatorProxyV2WithExternalLiquidity;

// ************************* External Addresses *************************

const BORROW_POSITION_PROXY_V2_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x38E49A617305101216eC6306e3a18065D14Bf3a7',
};

export const BORROW_POSITION_PROXY_V2 = new BaseContract(
  BORROW_POSITION_PROXY_V2_MAP[NETWORK_ID],
  BorrowPositionProxyV2__factory.createInterface(),
) as BorrowPositionProxyV2;

const ES_GMX_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA',
};

export const ES_GMX = new BaseContract(
  ES_GMX_MAP[NETWORK_ID],
  IERC20__factory.createInterface(),
) as IERC20;

const FS_GLP_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
};

export const FS_GLP = new BaseContract(
  FS_GLP_MAP[NETWORK_ID],
  IERC20__factory.createInterface(),
) as IERC20;

const GLP_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258',
};

export const GLP = new BaseContract(
  GLP_MAP[NETWORK_ID],
  IERC20__factory.createInterface(),
) as IERC20;

const GLP_MANAGER_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x3963FfC9dff443c2A94f21b129D429891E32ec18',
};

export const GLP_MANAGER = new BaseContract(
  GLP_MANAGER_MAP[NETWORK_ID],
  IGLPManager__factory.createInterface(),
) as IGLPManager;

const GLP_REWARD_ROUTER_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0xB95DB5B167D75e6d04227CfFFA61069348d271F5',
};

export const GLP_REWARD_ROUTER = new BaseContract(
  GLP_REWARD_ROUTER_MAP[NETWORK_ID],
  IGLPRewardRouterV2__factory.createInterface(),
) as IGLPRewardRouterV2;

const GMX_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
};

export const GMX = new BaseContract(
  GMX_MAP[NETWORK_ID],
  IERC20__factory.createInterface(),
) as IERC20;

const GMX_VAULT_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
};

export const GMX_VAULT = new BaseContract(
  GMX_VAULT_MAP[NETWORK_ID],
  IGMXVault__factory.createInterface(),
) as IGMXVault;

const V_GLP_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0xA75287d2f8b217273E7FCD7E86eF07D33972042E',
};

export const V_GLP = new BaseContract(
  V_GLP_MAP[NETWORK_ID],
  IVGlp__factory.createInterface(),
) as IVGlp;

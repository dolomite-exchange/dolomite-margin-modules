import { BaseContract } from 'ethers';
import {
  IDolomiteAmmFactory, IDolomiteAmmFactory__factory, IDolomiteAmmRouterProxy, IDolomiteAmmRouterProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  ERC20,
  ERC20__factory,
  IWETH,
  IWETH__factory,
} from '../types';

// ************************* External Contract Addresses *************************

export const USDC = new BaseContract(
  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  ERC20__factory.createInterface(),
) as ERC20;

export const WETH = new BaseContract(
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  IWETH__factory.createInterface(),
) as IWETH;

// ************************* Network Addresses *************************

export const DOLOMITE_AMM_FACTORY = new BaseContract(
  '0xD99c21C96103F36BC1FA26DD6448af4DA030c1EF',
  IDolomiteAmmFactory__factory.createInterface(),
) as IDolomiteAmmFactory;

export const DOLOMITE_AMM_ROUTER = new BaseContract(
  '0xa09B4a3FC92965E587a94539ee8B35ECf42D5A08',
  IDolomiteAmmRouterProxy__factory.createInterface(),
) as IDolomiteAmmRouterProxy;

export const DOLOMITE_MARGIN = new BaseContract(
    '0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072',
  IDolomiteMargin__factory.createInterface(),
) as IDolomiteMargin;

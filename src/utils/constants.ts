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
import * as DolomiteAmmFactoryJson from '@dolomite-margin/build/contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/build/contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/build/contracts/DolomiteMargin.json';

const arbitrumNetworkId = '42161';

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
  DolomiteAmmFactoryJson.networks[arbitrumNetworkId].address,
  IDolomiteAmmFactory__factory.createInterface(),
) as IDolomiteAmmFactory;

export const DOLOMITE_AMM_ROUTER = new BaseContract(
  DolomiteAmmRouterProxyJson.networks[arbitrumNetworkId].address,
  IDolomiteAmmRouterProxy__factory.createInterface(),
) as IDolomiteAmmRouterProxy;

export const DOLOMITE_MARGIN = new BaseContract(
  DolomiteMarginJson.networks[arbitrumNetworkId].address,
  IDolomiteMargin__factory.createInterface(),
) as IDolomiteMargin;

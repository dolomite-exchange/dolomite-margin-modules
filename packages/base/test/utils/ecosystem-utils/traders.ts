import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  OdosAggregatorTrader,
  OdosAggregatorTrader__factory,
  ParaswapAggregatorTrader,
  ParaswapAggregatorTrader__factory,
  ParaswapAggregatorTraderV2,
  ParaswapAggregatorTraderV2__factory,
} from '../../../src/types';
import {
  CoreProtocolWithOdos,
  CoreProtocolWithParaswap,
  getOdosAggregatorTraderConstructorParams,
  getParaswapAggregatorTraderConstructorParams,
  getParaswapAggregatorTraderV2ConstructorParams,
} from '../../../src/utils/constructors/traders';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';

export async function createParaswapAggregatorTrader<T extends Network>(
  core: CoreProtocolWithParaswap<T>,
): Promise<ParaswapAggregatorTrader> {
  return await createContractWithAbi<ParaswapAggregatorTrader>(
    ParaswapAggregatorTrader__factory.abi,
    ParaswapAggregatorTrader__factory.bytecode,
    getParaswapAggregatorTraderConstructorParams(core),
  );
}

export async function createParaswapAggregatorTraderV2<T extends Network>(
  core: CoreProtocolWithParaswap<T>,
): Promise<ParaswapAggregatorTraderV2> {
  return await createContractWithAbi<ParaswapAggregatorTraderV2>(
    ParaswapAggregatorTraderV2__factory.abi,
    ParaswapAggregatorTraderV2__factory.bytecode,
    getParaswapAggregatorTraderV2ConstructorParams(core),
  );
}

export async function createOdosAggregatorTrader<T extends Network>(
  core: CoreProtocolWithOdos<T>,
): Promise<OdosAggregatorTrader> {
  return await createContractWithAbi<OdosAggregatorTrader>(
    OdosAggregatorTrader__factory.abi,
    OdosAggregatorTrader__factory.bytecode,
    getOdosAggregatorTraderConstructorParams(core),
  );
}
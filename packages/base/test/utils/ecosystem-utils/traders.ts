import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  OdosAggregatorTrader,
  OdosAggregatorTrader__factory,
  OkxAggregatorTrader,
  OkxAggregatorTrader__factory,
  OogaBoogaAggregatorTrader,
  OogaBoogaAggregatorTrader__factory,
  ParaswapAggregatorTrader,
  ParaswapAggregatorTrader__factory,
  ParaswapAggregatorTraderV2,
  ParaswapAggregatorTraderV2__factory,
  TestOkxAggregatorTrader,
  TestOkxAggregatorTrader__factory,
} from '../../../src/types';
import {
  CoreProtocolWithOdos,
  CoreProtocolWithOkx,
  CoreProtocolWithParaswap,
  getOdosAggregatorTraderConstructorParams,
  getOogaBoogaAggregatorTraderConstructorParams,
  getOkxAggregatorTraderConstructorParams,
  getParaswapAggregatorTraderConstructorParams,
  getParaswapAggregatorTraderV2ConstructorParams,
} from '../../../src/utils/constructors/traders';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocolBerachainBartio } from '../core-protocols/core-protocol-berachain-bartio';
import { CoreProtocolBerachain } from '../core-protocols/core-protocol-berachain';

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

export async function createTestOkxAggregatorTrader<T extends Network>(
  core: CoreProtocolWithOkx<T>,
): Promise<TestOkxAggregatorTrader> {
  return await createContractWithAbi<TestOkxAggregatorTrader>(
    TestOkxAggregatorTrader__factory.abi,
    TestOkxAggregatorTrader__factory.bytecode,
    getOkxAggregatorTraderConstructorParams(core),
  );
}

export async function createOkxAggregatorTrader<T extends Network>(
  core: CoreProtocolWithOkx<T>,
): Promise<OkxAggregatorTrader> {
  return await createContractWithAbi<OkxAggregatorTrader>(
    OkxAggregatorTrader__factory.abi,
    OkxAggregatorTrader__factory.bytecode,
    getOkxAggregatorTraderConstructorParams(core),
  );
}

export async function createOogaBoogaAggregatorTrader(
  core: CoreProtocolBerachain
): Promise<OogaBoogaAggregatorTrader> {
  return await createContractWithAbi<OogaBoogaAggregatorTrader>(
    OogaBoogaAggregatorTrader__factory.abi,
    OogaBoogaAggregatorTrader__factory.bytecode,
    getOogaBoogaAggregatorTraderConstructorParams(core),
  );
}

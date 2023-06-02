import { ParaswapAggregatorTrader, ParaswapAggregatorTrader__factory } from '../../../src/types';
import { getParaswapTraderConstructorParams } from '../../../src/utils/constructors/traders';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createParaswapAggregatorTrader(
  core: CoreProtocol,
): Promise<ParaswapAggregatorTrader> {
  return await createContractWithAbi<ParaswapAggregatorTrader>(
    ParaswapAggregatorTrader__factory.abi,
    ParaswapAggregatorTrader__factory.bytecode,
    getParaswapTraderConstructorParams(core),
  );
}

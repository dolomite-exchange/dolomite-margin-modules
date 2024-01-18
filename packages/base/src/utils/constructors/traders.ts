import { CoreProtocol } from '../../../test/utils/setup';

export function getParaswapAggregatorTraderConstructorParams(core: CoreProtocol): any[] {
  return [
    core.paraswapEcosystem!.augustusRouter.address,
    core.paraswapEcosystem!.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getParaswapAggregatorTraderV2ConstructorParams(core: CoreProtocol): any[] {
  return [
    core.paraswapEcosystem!.augustusRouter.address,
    core.paraswapEcosystem!.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getOdosAggregatorTraderConstructorParams(core: CoreProtocol): any[] {
  return [
    core.odosEcosystem!.odosRouter.address,
    core.dolomiteMargin.address,
  ];
}

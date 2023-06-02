import { CoreProtocol } from '../../../test/utils/setup';

export function getParaswapTraderConstructorParams(core: CoreProtocol): any[] {
  return [
    core.paraswapEcosystem!.augustusRouter,
    core.paraswapEcosystem!.transferProxy,
    core.dolomiteMargin.address,
  ];
}

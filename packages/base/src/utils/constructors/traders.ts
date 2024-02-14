import { Network } from '../no-deps-constants';
import { ParaswapEcosystem } from '../../../test/utils/ecosystem-utils/paraswap';
import { OdosEcosystem } from '../../../test/utils/ecosystem-utils/odos';
import { DolomiteMargin } from '../../../test/utils/dolomite';
import { CoreProtocolType } from '../../../test/utils/setup';

export type CoreProtocolWithParaswap<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  paraswapEcosystem: ParaswapEcosystem;
}>;

export type CoreProtocolWithOdos<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  odosEcosystem: OdosEcosystem;
}>;

export function getParaswapAggregatorTraderConstructorParams<T extends Network>(
  core: CoreProtocolWithParaswap<T>,
): any[] {
  return [
    core.paraswapEcosystem.augustusRouter.address,
    core.paraswapEcosystem.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getParaswapAggregatorTraderV2ConstructorParams<T extends Network>(
  core: CoreProtocolWithParaswap<T>,
): any[] {
  return [
    core.paraswapEcosystem!.augustusRouter.address,
    core.paraswapEcosystem!.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getOdosAggregatorTraderConstructorParams<T extends Network>(
  core: CoreProtocolWithOdos<T>,
): any[] {
  return [
    core.odosEcosystem!.odosRouter.address,
    core.dolomiteMargin.address,
  ];
}

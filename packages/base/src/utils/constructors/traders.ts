import { EnsoEcosystem } from '../../../test/utils/ecosystem-utils/enso';
import { DolomiteNetwork, Network } from '../no-deps-constants';
import { ParaswapEcosystem } from '../../../test/utils/ecosystem-utils/paraswap';
import { OdosEcosystem } from '../../../test/utils/ecosystem-utils/odos';
import { DolomiteMargin } from '../../../test/utils/dolomite';
import { CoreProtocolType } from '../../../test/utils/setup';
import { OkxEcosystem } from 'packages/base/test/utils/ecosystem-utils/okx';
import { OogaBoogaEcosystem } from 'packages/base/test/utils/ecosystem-utils/ooga-booga';

export type CoreProtocolWithEnso<T extends DolomiteNetwork> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  ensoEcosystem: EnsoEcosystem;
}>;

export type CoreProtocolWithParaswap<T extends DolomiteNetwork> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  paraswapEcosystem: ParaswapEcosystem;
}>;

export type CoreProtocolWithOdos<T extends DolomiteNetwork> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  odosEcosystem: OdosEcosystem;
}>;

export type CoreProtocolWithOkx<T extends DolomiteNetwork> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  okxEcosystem: OkxEcosystem;
}>;

export type CoreProtocolWithOogaBooga<T extends DolomiteNetwork> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  oogaBoogaEcosystem: OogaBoogaEcosystem;
}>;

export function getEnsoAggregatorTraderConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithEnso<T>,
): any[] {
  return       [
    core.ensoEcosystem.router.address,
    core.dolomiteMargin.address,
  ];
}

export function getParaswapAggregatorTraderConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithParaswap<T>,
): any[] {
  return [
    core.paraswapEcosystem.augustusRouter.address,
    core.paraswapEcosystem.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getParaswapAggregatorTraderV2ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithParaswap<T>,
): any[] {
  return [
    core.paraswapEcosystem!.augustusRouter.address,
    core.paraswapEcosystem!.transferProxy,
    core.dolomiteMargin.address,
  ];
}

export function getOdosAggregatorTraderConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithOdos<T>,
): any[] {
  return [
    core.odosEcosystem.odosRouter.address,
    core.dolomiteMargin.address,
  ];
}

export function getOkxAggregatorTraderConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithOkx<T>,
): any[] {
  return [
    core.okxEcosystem.dexRouter.address,
    core.okxEcosystem.transferProxy.address,
    core.dolomiteMargin.address,
  ];
}

export function getOogaBoogaAggregatorTraderConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolWithOogaBooga<T>
): any[] {
  return [
    core.oogaBoogaEcosystem.oogaBoogaRouter.address,
    core.dolomiteMargin.address,
  ];
}

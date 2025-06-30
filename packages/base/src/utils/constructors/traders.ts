import { DolomiteNetwork, Network } from '../no-deps-constants';
import { ParaswapEcosystem } from '../../../test/utils/ecosystem-utils/paraswap';
import { OdosEcosystem } from '../../../test/utils/ecosystem-utils/odos';
import { DolomiteMargin } from '../../../test/utils/dolomite';
import { CoreProtocolType } from '../../../test/utils/setup';
import { OkxEcosystem } from 'packages/base/test/utils/ecosystem-utils/okx';

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

export function getOogaBoogaAggregatorTraderConstructorParams(
  core: CoreProtocolType<Network.Berachain>,
): any[] {
  return [
    core.oogaBoogaEcosystem.oogaBoogaRouter.address,
    core.dolomiteMargin.address,
  ];
}

export function getVeloraAggregatorTraderConstructorParams<T extends Network>(
  core: CoreProtocolWithParaswap<T>,
): any[] {
  return [
    core.paraswapEcosystem.augustusSwapper.address,
    core.dolomiteMargin.address,
  ];
}

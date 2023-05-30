import { address } from '@dolomite-exchange/dolomite-margin';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IPendlePtGLP2024Registry, IPendlePtGLP2024WrappedTokenUserVaultFactory,
  IPendlePtGLP2024WrappedTokenUserVaultV1,
  PendlePtGLP2024Registry, PendlePtGLP2024WrappedTokenUserVaultFactory,
  PendlePtGLP2024WrappedTokenUserVaultV1,
} from '../../types';

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024WrappedTokenUserVaultFactory | PendlePtGLP2024WrappedTokenUserVaultFactory,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dptGlp.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getPendlePtGLP2024RegistryConstructorParams(
  core: CoreProtocol,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    core.pendleEcosystem!.pendleRouter.address,
    core.pendleEcosystem!.ptGlpMarket.address,
    core.pendleEcosystem!.ptGlpToken.address,
    core.pendleEcosystem!.ptOracle.address,
    core.pendleEcosystem!.syGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024UnwrapperTraderConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxRegistry!.address,
    core.marketIds.usdc!,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024WrappedTokenUserVaultFactoryConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
  ptGlpToken: { address: address },
  userVaultImplementation: IPendlePtGLP2024WrappedTokenUserVaultV1 | PendlePtGLP2024WrappedTokenUserVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    ptGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024WrapperTraderConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxRegistry!.address,
    core.dolomiteMargin.address,
  ];
}

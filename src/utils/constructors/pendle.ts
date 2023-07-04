import { CoreProtocol } from '../../../test/utils/setup';
import {
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendlePtGLP2024Registry,
  IPendlePtToken,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024Registry,
} from '../../types';

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
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

export function getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dptGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
  ptGlpToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLP2024IsolationModeTokenVaultV1 | PendlePtGLP2024IsolationModeTokenVaultV1,
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

export function getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dptGlp.address,
    core.dolomiteMargin.address,
  ];
}

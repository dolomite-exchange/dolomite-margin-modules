import { BigNumberish } from 'ethers';
import { CoreProtocol } from '../../../packages/base/test/utils/setup';
import {
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendleGLPRegistry,
  IPendlePtToken,
  IPendleYtToken,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendleGLPRegistry,
  IPendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleRegistry,
  IPendleRegistry,
  PendlePtIsolationModeVaultFactory,
  IPendlePtIsolationModeVaultFactory, IERC20, IPendlePtMarket, IPendleSyToken, IPendlePtOracle,
} from '../../types';

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
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

export async function getPendleGLPRegistryConstructorParams(
  implementation: PendleGLPRegistry,
  core: CoreProtocol,
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    core.pendleEcosystem!.glpMar2024.ptGlpMarket.address,
    core.pendleEcosystem!.glpMar2024.ptGlpToken.address,
    core.pendleEcosystem!.glpMar2024.ptOracle.address,
    core.pendleEcosystem!.syGlpToken.address,
    core.pendleEcosystem!.glpMar2024.ytGlpToken.address,
    core.dolomiteRegistry.address
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data
  ];
}

export async function getPendleRegistryConstructorParams(
  implementation: PendleRegistry,
  core: CoreProtocol,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  syToken: IPendleSyToken,
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    ptMarket.address,
    ptOracle.address,
    syToken.address,
    core.dolomiteRegistry.address
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data
  ];
}

export function getPendlePtIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  registry: IPendleRegistry | PendleRegistry,
  ptToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLP2024IsolationModeTokenVaultV1 | PendlePtGLP2024IsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    registry.address,
    ptToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtPriceOracleConstructorParams(
  core: CoreProtocol,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dptToken.address,
    pendleRegistry.address,
    underlyingToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptFactory: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    underlyingToken.address,
    dptFactory.address,
    core.dolomiteMargin.address
  ];
}

export function getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    underlyingToken.address,
    dptToken.address,
    core.dolomiteMargin.address
  ];
}

export function getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
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
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
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

export function getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLP2024IsolationModeTokenVaultV1 | PendleYtGLP2024IsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    core.tokens.weth.address,
    core.marketIds.weth,
    pendleRegistry.address,
    debtMarketIds,
    collateralMarketIds,
    ytGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
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

export function getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dytGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dytGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dytGlp.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
  ];
}

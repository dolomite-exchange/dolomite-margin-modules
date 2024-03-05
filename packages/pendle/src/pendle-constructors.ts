import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { PendleEcosystem } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/pendle';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  IERC20,
  IPendleGLPRegistry,
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendlePtIsolationModeVaultFactory,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleRegistry,
  IPendleSyToken,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeVaultFactory,
  IPendleYtToken,
  PendleGLPRegistry,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory,
  PendleRegistry,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeVaultFactory,
} from './types';

export type CoreProtocolWithPendle<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  pendleEcosystem: PendleEcosystem;
}>;

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export async function getPendleRegistryConstructorParams<T extends Network>(
  implementation: PendleRegistry,
  core: CoreProtocolWithPendle<T>,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  syToken: IPendleSyToken,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    ptMarket.address,
    ptOracle.address,
    syToken.address,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getPendlePtIsolationModeVaultFactoryConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function getPendlePtPriceOracleConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function getPendlePtIsolationModeWrapperTraderV2ConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
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

export function getSimplePtUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  factory: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address
  ];
}

export function getSimplePtWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  factory: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address
  ];
}
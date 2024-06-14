import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CorePendleEcosystem } from 'packages/base/test/utils/ecosystem-utils/pendle';
import {
  IERC20,
  IPendleGLPRegistry,
  IPendlePtGLPMar2024IsolationModeTokenVaultV1,
  IPendlePtGLPMar2024IsolationModeVaultFactory,
  IPendlePtIsolationModeVaultFactory,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleRegistry,
  IPendleSyToken,
  IPendleYtGLPMar2024IsolationModeTokenVaultV1,
  IPendleYtGLPMar2024IsolationModeVaultFactory,
  IPendleYtToken,
  PendleGLPRegistry,
  PendlePtGLPMar2024IsolationModeTokenVaultV1,
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory,
  PendleRegistry,
  PendleYtGLPMar2024IsolationModeTokenVaultV1,
  PendleYtGLPMar2024IsolationModeVaultFactory,
} from './types';

export type CoreProtocolWithPendle<T extends Network> = Extract<
  CoreProtocolType<T>,
  {
    dolomiteMargin: DolomiteMargin<T>;
    pendleEcosystem: CorePendleEcosystem;
  }
>;

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [dptGlp.address, pendleRegistry.address, core.dolomiteMargin.address, core.marketIds.dfsGlp!];
}

export async function getPendleGLPRegistryConstructorParams(
  implementation: PendleGLPRegistry,
  core: CoreProtocolArbitrumOne,
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouterV3.address,
    core.pendleEcosystem!.glpMar2024.glpMarket.address,
    core.pendleEcosystem!.glpMar2024.ptGlpToken.address,
    core.pendleEcosystem!.glpMar2024.ptOracle.address,
    core.pendleEcosystem!.syGlpMar2024Token.address,
    core.pendleEcosystem!.glpMar2024.ytGlpToken.address,
    core.dolomiteRegistry.address,
  );

  return [implementation.address, core.dolomiteMargin.address, calldata.data];
}

export async function getPendleRegistryConstructorParams<T extends Network>(
  implementation: PendleRegistry,
  core: CoreProtocolWithPendle<T>,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  syToken: IPendleSyToken,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouterV3.address,
    ptMarket.address,
    ptOracle.address,
    syToken.address,
    core.dolomiteRegistry.address,
  );

  return [implementation.address, core.dolomiteMargin.address, calldata.data];
}

export function getPendlePtIsolationModeVaultFactoryConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  registry: IPendleRegistry | PendleRegistry,
  ptToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLPMar2024IsolationModeTokenVaultV1 | PendlePtGLPMar2024IsolationModeTokenVaultV1,
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

  return [dptToken.address, pendleRegistry.address, underlyingToken.address, core.dolomiteMargin.address];
}

export function getPendlePtPriceOracleV2ConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [dptToken.address, pendleRegistry.address, core.dolomiteMargin.address];
}

export function getPendlePtRsEthPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [dptToken.address, pendleRegistry.address, core.tokens.rsEth.address, core.dolomiteMargin.address];
}

export function getPendlePtEEthPriceOracleConstructorParamsz(
  core: CoreProtocolArbitrumOne,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [dptToken.address, pendleRegistry.address, core.tokens.weEth.address, core.dolomiteMargin.address];
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

  return [pendleRegistry.address, underlyingToken.address, dptFactory.address, core.dolomiteMargin.address];
}

export function getPendlePtIsolationModeWrapperTraderV3ConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  pendleRegistry: IPendleRegistry | PendleRegistry | IPendleGLPRegistry,
  underlyingToken: IERC20,
  dptFactory: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [pendleRegistry.address, underlyingToken.address, dptFactory.address, core.dolomiteMargin.address];
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

  return [pendleRegistry.address, underlyingToken.address, dptToken.address, core.dolomiteMargin.address];
}

export function getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  pendleRegistry: IPendleRegistry | PendleRegistry | IPendleGLPRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [pendleRegistry.address, underlyingToken.address, dptToken.address, core.dolomiteMargin.address];
}

export function getPendlePtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
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

export function getPendlePtGLPMar2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolArbitrumOne,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  ptGlpToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLPMar2024IsolationModeTokenVaultV1 | PendlePtGLPMar2024IsolationModeTokenVaultV1,
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

export function getPendleYtGLPMar2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolArbitrumOne,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLPMar2024IsolationModeTokenVaultV1 | PendleYtGLPMar2024IsolationModeTokenVaultV1,
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

export function getPendlePtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
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

export function getPendleYtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
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

export function getPendleYtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
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
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [dytGlp.address, pendleRegistry.address, core.dolomiteMargin.address, core.marketIds.dfsGlp!];
}

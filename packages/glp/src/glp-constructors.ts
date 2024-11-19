import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1, IERC20,
  IGLPIsolationModeTokenVaultV1,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  IGmxRegistryV1,
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV2,
} from './types';

export function getGLPPriceOracleV1ConstructorParams(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld | IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [gmxRegistry.address, dfsGlp.address];
}

export function getGLPIsolationModeUnwrapperTraderV1ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.tokens.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  sGlp: IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    sGlp.address,
    gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export type GmxUserVaultImplementation =
  IGLPIsolationModeTokenVaultV1
  | GLPIsolationModeTokenVaultV1
  | TestGLPIsolationModeTokenVaultV1
  | GLPIsolationModeTokenVaultV2
  | TestGLPIsolationModeTokenVaultV2;

export function getGLPIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolArbitrumOne,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): any[] {
  return [
    core.tokens.weth.address,
    core.marketIds.weth,
    gmxRegistry.address,
    core.gmxEcosystem!.fsGlp.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPWrapperTraderV1ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.tokens.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  fsGlp: IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    fsGlp.address,
    gmxRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function getGmxRegistryConstructorParams(
  implementation: GmxRegistryV1,
  core: CoreProtocolArbitrumOne,
): Promise<any[]> {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  const initializer = {
    bnGmx: core.gmxEcosystem.bnGmx.address,
    esGmx: core.gmxEcosystem.esGmx.address,
    fsGlp: core.gmxEcosystem.fsGlp.address,
    glp: core.gmxEcosystem.glp.address,
    glpManager: core.gmxEcosystem.glpManager.address,
    glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
    gmx: core.gmxEcosystem.gmx.address,
    gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouterV2.address,
    gmxVault: core.gmxEcosystem.gmxVault.address,
    sGlp: core.gmxEcosystem.sGlp.address,
    sGmx: core.gmxEcosystem.sGmx.address,
    sbfGmx: core.gmxEcosystem.sbfGmx.address,
    vGlp: core.gmxEcosystem.vGlp.address,
    vGmx: core.gmxEcosystem.vGmx.address,
  };

  return [
    implementation.address,
    core.dolomiteMargin.address,
    (await implementation.populateTransaction.initialize(initializer, core.dolomiteRegistry.address)).data!,
  ];
}

export function getGMXIsolationModeVaultFactoryConstructorParams(
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GMXIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    gmxRegistry.address,
    core.gmxEcosystem!.gmx.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getGMXWrapperTraderV2ConstructorParams(
  dGmx: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    dGmx.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getGMXUnwrapperTraderV2ConstructorParams(
  dGmx: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    dGmx.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getStakedGmxReaderConstructorParams(
  glpFactory: { address: string },
): any[] {
  return [glpFactory.address];
}

export function getEsGmxReaderConstructorParams(
  glpFactory: { address: string },
): any[] {
  return [glpFactory.address];
}

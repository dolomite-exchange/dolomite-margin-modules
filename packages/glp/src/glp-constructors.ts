import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocol } from '../../base/test/utils/setup';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeVaultFactory,
  GmxRegistryV1,
  IGLPIsolationModeTokenVaultV1,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGmxRegistryV1,
  TestGLPIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2,
  IGMXIsolationModeVaultFactory,
  GMXIsolationModeVaultFactory,
} from './types';

export function getGLPPriceOracleV1ConstructorParams(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [gmxRegistry.address, dfsGlp.address];
}

export function getGLPUnwrapperTraderV1ConstructorParams(
  core: CoreProtocol,
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
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    gmxRegistry.address,
    dfsGlp.address,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
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

export function getGLPIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
): any[] {
  return [
    dGmx.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getGMXUnwrapperTraderV2ConstructorParams(
  dGmx: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
  core: CoreProtocol,
): any[] {
  return [
    dGmx.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}
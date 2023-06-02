import { CoreProtocol } from '../../../test/utils/setup';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeVaultFactory,
  GmxRegistryV1,
  IGLPIsolationModeTokenVaultV1,
  IGLPIsolationModeVaultFactory,
  IGmxRegistryV1,
  TestGLPIsolationModeTokenVaultV1,
} from '../../types';

export function getGLPPriceOracleV1ConstructorParams(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [gmxRegistry.address, dfsGlp.address];
}

export function getGLPUnwrapperTraderConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export type GmxUserVaultImplementation =
  IGLPIsolationModeTokenVaultV1
  | GLPIsolationModeTokenVaultV1
  | TestGLPIsolationModeTokenVaultV1;

export function getGLPIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): any[] {
  return [
    core.weth.address,
    core.marketIds.weth,
    gmxRegistry.address,
    core.gmxEcosystem!.fsGlp.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPWrapperTraderConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGmxRegistryConstructorParams(core: CoreProtocol): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  return [
    {
      esGmx: core.gmxEcosystem.esGmx.address,
      fsGlp: core.gmxEcosystem.fsGlp.address,
      glp: core.gmxEcosystem.glp.address,
      glpManager: core.gmxEcosystem.glpManager.address,
      glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
      gmx: core.gmxEcosystem.gmx.address,
      gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
      gmxVault: core.gmxEcosystem.gmxVault.address,
      sGlp: core.gmxEcosystem.sGlp.address,
      sGmx: core.gmxEcosystem.sGmx.address,
      sbfGmx: core.gmxEcosystem.sbfGmx.address,
      vGlp: core.gmxEcosystem.vGlp.address,
      vGmx: core.gmxEcosystem.vGmx.address,
    },
    core.dolomiteMargin.address,
  ];
}

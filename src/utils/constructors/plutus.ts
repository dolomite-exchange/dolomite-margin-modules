import { address } from '@dolomite-margin/dist/src';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IPlutusVaultGLPIsolationModeTokenVaultV1,
  IPlutusVaultRegistry,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1, PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultRegistry,
} from '../../types';

export function getPlutusVaultRegistryConstructorParams(core: CoreProtocol): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.plutusEcosystem.plsToken.address,
    core.plutusEcosystem.plvGlp.address,
    core.plutusEcosystem.plvGlpRouter.address,
    core.plutusEcosystem.plvGlpFarm.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  PlutusVaultGLPIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
    dplvGlpToken.address,
    plutusVaultRegistry.address,
    PlutusVaultGLPIsolationModeUnwrapperTraderV1.address,
  ];
}

export function getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.usdc.address,
    core.gmxRegistry!.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(
  core: CoreProtocol,
  unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  wrapperTrader: PlutusVaultGLPIsolationModeWrapperTraderV1,
  plutusWhitelist: address,
  dplvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    unwrapperTrader.address,
    wrapperTrader.address,
    plutusWhitelist,
    dplvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  plvGlpToken: { address: address },
  userVaultImplementation: IPlutusVaultGLPIsolationModeTokenVaultV1 | PlutusVaultGLPIsolationModeTokenVaultV1,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    plutusVaultRegistry.address,
    plvGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.gmxRegistry!.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

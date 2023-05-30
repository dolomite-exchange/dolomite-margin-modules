import { address } from '@dolomite-margin/dist/src';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IPlutusVaultGLPWrappedTokenUserVaultV1,
  IPlutusVaultRegistry,
  PlutusVaultGLPUnwrapperTrader, PlutusVaultGLPWrappedTokenUserVaultV1,
  PlutusVaultGLPWrapperTrader,
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
  plutusVaultGLPUnwrapperTrader: PlutusVaultGLPUnwrapperTrader,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
    dplvGlpToken.address,
    plutusVaultRegistry.address,
    plutusVaultGLPUnwrapperTrader.address,
  ];
}

export function getPlutusVaultGLPUnwrapperTraderConstructorParams(
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
  unwrapperTrader: PlutusVaultGLPUnwrapperTrader,
  wrapperTrader: PlutusVaultGLPWrapperTrader,
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

export function getPlutusVaultGLPWrappedTokenUserVaultFactoryConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  plvGlpToken: { address: address },
  userVaultImplementation: IPlutusVaultGLPWrappedTokenUserVaultV1 | PlutusVaultGLPWrappedTokenUserVaultV1,
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

export function getPlutusVaultGLPWrapperTraderConstructorParams(
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

import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { address } from '@dolomite-margin/dist/src';
import {
  IPlutusVaultGLPIsolationModeTokenVaultV1,
  IPlutusVaultRegistry,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV2,
  PlutusVaultRegistry,
} from './types';

export async function getPlutusVaultRegistryConstructorParams(
  implementation: PlutusVaultRegistry,
  core: CoreProtocolArbitrumOne,
): Promise<any[]> {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.plutusEcosystem.plsToken.address,
    core.plutusEcosystem.plvGlp.address,
    core.plutusEcosystem.plvGlpRouter.address,
    core.plutusEcosystem.plvGlpFarm.address,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata!.data,
  ];
}

export function getPlutusVaultGLPPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
    dplvGlpToken.address,
    plutusVaultRegistry.address,
    unwrapper.address,
  ];
}

export function getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.chainlinkAutomationRegistry.address,
    core.marketIds.dfsGlp!,
    dplvGlpToken.address,
    plutusVaultRegistry.address,
    unwrapper.address,
  ];
}

export function getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams(
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.tokens.usdc.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.gmxEcosystem!.live.gmxRegistry.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(
  core: CoreProtocolArbitrumOne,
  unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  wrapperTrader: PlutusVaultGLPIsolationModeWrapperTraderV1 | PlutusVaultGLPIsolationModeWrapperTraderV2,
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
  core: CoreProtocolArbitrumOne,
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
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.gmxEcosystem!.live.gmxRegistry.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.gmxEcosystem!.live.gmxRegistry.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

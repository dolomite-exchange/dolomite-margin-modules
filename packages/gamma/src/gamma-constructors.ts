import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeVaultFactory,
  GammaRegistry,
  IGammaIsolationModeTokenVaultV1,
  IGammaIsolationModeVaultFactory,
  IGammaPool,
  IGammaRegistry
} from './types';

export async function getGammaRegistryConstructorParams(
  implementation: GammaRegistry,
  core: CoreProtocolArbitrumOne
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(core.dolomiteRegistry.address);
  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getGammaIsolationModeVaultFactoryConstructorParams(
  gammaRegistry: IGammaRegistry | GammaRegistry,
  gammaPool: IGammaPool,
  vaultImplementation: IGammaIsolationModeTokenVaultV1 | GammaIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne
): any[] {
  return [
    gammaRegistry.address,
    gammaPool.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getGammaUnwrapperTraderV2ConstructorParams(
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getGammaWrapperTraderV2ConstructorParams(
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

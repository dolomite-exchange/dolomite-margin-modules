import {
  ARBIsolationModeTokenVaultV1,
  ARBIsolationModeVaultFactory,
  ARBRegistry,
  IARBIsolationModeTokenVaultV1,
  IARBIsolationModeVaultFactory,
  IARBRegistry,
} from './types';

export async function getARBRegistryConstructorParams(
  implementation: ARBRegistry,
  core: CoreProtocolArbitrumOne
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(core.dolomiteRegistry.address);
  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getARBIsolationModeVaultFactoryConstructorParams(
  arbRegistry: IARBRegistry | ARBRegistry,
  vaultImplementation: IARBIsolationModeTokenVaultV1 | ARBIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne
): any[] {
  return [
    arbRegistry.address,
    core.tokens.arb!.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getARBUnwrapperTraderV2ConstructorParams(
  factory: IARBIsolationModeVaultFactory | ARBIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getARBWrapperTraderV2ConstructorParams(
  factory: IARBIsolationModeVaultFactory | ARBIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

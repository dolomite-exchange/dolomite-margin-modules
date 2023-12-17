import { CoreProtocol } from '../../../test/utils/setup';
import {
  ARBIsolationModeTokenVaultV1, ARBIsolationModeVaultFactory,
  ARBRegistry,
  IARBIsolationModeTokenVaultV1,
  IARBIsolationModeVaultFactory, IARBRegistry,
} from '../../types';

export async function getARBRegistryConstructorParams(implementation: ARBRegistry, core: CoreProtocol): Promise<any[]> {
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
  core: CoreProtocol
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
  core: CoreProtocol,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
  ];
}

export function getARBWrapperTraderV2ConstructorParams(
  factory: IARBIsolationModeVaultFactory | ARBIsolationModeVaultFactory,
  core: CoreProtocol,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
  ];
}

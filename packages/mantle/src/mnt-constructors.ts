import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import {
  IMNTIsolationModeTokenVaultV1,
  IMNTIsolationModeVaultFactory,
  IMNTRegistry,
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeVaultFactory,
  MNTRegistry,
} from './types';

export async function getMNTRegistryConstructorParams(
  implementation: MNTRegistry,
  core: CoreProtocolMantle,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    core.dolomiteRegistry.address,
    core.mantleRewardStation.address,
  );
  return [implementation.address, core.dolomiteMargin.address, calldata.data];
}

export function getMNTIsolationModeVaultFactoryConstructorParams(
  mntRegistry: IMNTRegistry | MNTRegistry,
  vaultImplementation: IMNTIsolationModeTokenVaultV1 | MNTIsolationModeTokenVaultV1,
  core: CoreProtocolMantle,
): any[] {
  return [
    mntRegistry.address,
    core.tokens.wmnt.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getMNTUnwrapperTraderV2ConstructorParams(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): any[] {
  return [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address];
}

export function getMNTWrapperTraderV2ConstructorParams(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): any[] {
  return [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address];
}

import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IUSDCIsolationModeTokenVaultV1,
  IUSDCIsolationModeVaultFactory,
  IUSDCRegistry,
  USDCIsolationModeTokenVaultV1,
  USDCIsolationModeVaultFactory,
  USDCRegistry
} from './types';

export async function getUSDCRegistryConstructorParams(
  implementation: USDCRegistry,
  core: CoreProtocolArbitrumOne
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(core.dolomiteRegistry.address);
  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getUSDCIsolationModeVaultFactoryConstructorParams(
  usdcRegistry: IUSDCRegistry | USDCRegistry,
  vaultImplementation: IUSDCIsolationModeTokenVaultV1 | USDCIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne
): any[] {
  return [
    usdcRegistry.address,
    core.tokens.nativeUsdc!.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getUSDCUnwrapperTraderV2ConstructorParams(
  factory: IUSDCIsolationModeVaultFactory | USDCIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getUSDCWrapperTraderV2ConstructorParams(
  factory: IUSDCIsolationModeVaultFactory | USDCIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

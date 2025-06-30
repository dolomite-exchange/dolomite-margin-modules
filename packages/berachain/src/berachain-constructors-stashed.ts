import { BerachainRewardsRegistry, IBerachainRewardsRegistry } from './types';
import {
  CoreProtocolBerachain
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-berachain';

export function getBerachainRewardsIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: { address: string },
  core: CoreProtocolBerachain,
): any[] {
  return [
    beraRegistry.address,
    underlyingToken.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getBerachainRewardsUnwrapperTraderV2ConstructorParams(
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): any[] {
  return [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address];
}

export function getBerachainRewardsWrapperTraderV2ConstructorParams(
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): any[] {
  return [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address];
}

export function getBGTIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IBGTIsolationModeTokenVaultV1 | BGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): any[] {
  return [
    beraRegistry.address,
    underlyingToken.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getBGTIsolationModeUnwrapperTraderV2ConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): any[] {
  return [beraRegistry.address, factory.address, core.dolomiteMargin.address];
}

export function getBGTMIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IBGTMIsolationModeTokenVaultV1 | BGTMIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): any[] {
  return [
    beraRegistry.address,
    underlyingToken.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getBGTMIsolationModeUnwrapperTraderV2ConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  factory: IBGTMIsolationModeVaultFactory | BGTMIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): any[] {
  return [beraRegistry.address, factory.address, core.dolomiteMargin.address];
}

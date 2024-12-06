import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IBerachainRewardsRegistry,
  BerachainRewardsIsolationModeTokenVaultV1,
  IBerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsIsolationModeVaultFactory,
  IBerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsMetaVault,
  BGTIsolationModeTokenVaultV1,
  IBGTIsolationModeTokenVaultV1,
  IInfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1
} from './types';

export async function getBerachainRewardsRegistryConstructorParams(
  implementation: BerachainRewardsRegistry,
  metaVaultImplementation: BerachainRewardsMetaVault,
  core: CoreProtocolBerachain
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    core.tokens.bgt.address,
    core.tokens.iBgt.address,
    core.berachainRewardsEcosystem.iBgtStakingPool.address,
    metaVaultImplementation.address,
    core.dolomiteRegistry.address
  );
  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getBerachainRewardsIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IBerachainRewardsIsolationModeTokenVaultV1 | BerachainRewardsIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain
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
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getBerachainRewardsWrapperTraderV2ConstructorParams(
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): any[] {
  return [
    factory.address,
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
  ];
}

export function getBGTIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IBGTIsolationModeTokenVaultV1 | BGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain
): any[] {
  return [
    beraRegistry.address,
    underlyingToken.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getInfraredBGTIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IInfraredBGTIsolationModeTokenVaultV1 | InfraredBGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain
): any[] {
  return [
    beraRegistry.address,
    underlyingToken.address,
    core.borrowPositionProxyV2.address,
    vaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

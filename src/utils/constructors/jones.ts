import { address } from '@dolomite-margin/dist/src';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IJonesUSDCIsolationModeTokenVaultV1,
  IJonesUSDCRegistry,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCRegistry,
} from '../../types';

export function getJonesUSDCRegistryConstructorParams(
  core: CoreProtocol,
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.jonesEcosystem.glpAdapter.address,
    core.jonesEcosystem.glpVaultRouter.address,
    core.jonesEcosystem.whitelistController.address,
    core.jonesEcosystem.jUSDC.address,
    unwrapper.address,
    core.dolomiteMargin.address,
  ];
}

export function getJonesUSDCPriceOracleConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    jonesUSDCRegistry.address,
    core.marketIds.usdc,
    djUSDCToken.address,
  ];
}

export function getJonesUSDCIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.usdc!.address,
    jonesUSDCRegistry.address,
    djUSDCToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getJonesUSDCIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  jUSDCToken: { address: address },
  userVaultImplementation: IJonesUSDCIsolationModeTokenVaultV1 | JonesUSDCIsolationModeTokenVaultV1,
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    jonesUSDCRegistry.address,
    jUSDCToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.usdc!.address,
    jonesUSDCRegistry.address,
    djUSDCToken.address,
    core.dolomiteMargin.address,
  ];
}

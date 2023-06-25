import { address } from '@dolomite-margin/dist/src';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IUmamiAssetVaultIsolationModeTokenVaultV1,
  IUmamiAssetVaultRegistry,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultRegistry,
} from '../../types';
import { NONE_MARKET_ID } from '../no-deps-constants';

export function getUmamiAssetVaultRegistryConstructorParams(
  core: CoreProtocol,
): any[] {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  return [
    core.umamiEcosystem.whitelist.address,
    core.dolomiteMargin.address,
  ];
}

export function getUmamiAssetVaultPriceOracleConstructorParams(
  core: CoreProtocol,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiVaultIsolationModeToken: { address: address },
): any[] {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    umamiAssetVaultRegistry.address,
    umamiVaultIsolationModeToken.address,
  ];
}

export function getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiVaultIsolationModeToken: { address: address },
): any[] {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  return [
    umamiVaultIsolationModeToken.address,
    core.dolomiteMargin.address,
  ];
}

export async function getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiVaultToken: { address: address },
  underlyingTokenForUmamiVault: { address: address },
  userVaultImplementation: IUmamiAssetVaultIsolationModeTokenVaultV1 | UmamiAssetVaultIsolationModeTokenVaultV1,
): Promise<any[]> {
  if (!core.umamiEcosystem) {
    return Promise.reject(new Error('Umami ecosystem not initialized'));
  }

  return [
    umamiAssetVaultRegistry.address,
    [await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingTokenForUmamiVault.address)],
    [NONE_MARKET_ID],
    umamiVaultToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiVaultIsolationModeToken: { address: address },
): any[] {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  return [
    umamiVaultIsolationModeToken.address,
    core.dolomiteMargin.address,
  ];
}

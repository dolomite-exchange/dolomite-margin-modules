import { address } from '@dolomite-margin/dist/src';
import { BigNumber } from 'ethers';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IUmamiAssetVault,
  IUmamiAssetVaultIsolationModeTokenVaultV1,
  IUmamiAssetVaultRegistry,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultRegistry,
} from '../../types';

const ONE_SCALED = BigNumber.from('1000000000000000000');
const GLOBAL_COLLATERALIZATION = BigNumber.from('1150000000000000000');

export function getUmamiTokenCollateralization(
  asset: IUmamiAssetVault,
  core: CoreProtocol,
): {
  minCollateralization: BigNumber;
  liquidationSpread: BigNumber;
  marginPremium: BigNumber,
  liquidationSpreadPremium: BigNumber
} {
  if (asset.address === core.umamiEcosystem!.glpLink.address || asset.address === core.umamiEcosystem!.glpUni.address) {
    const minCollateralization = BigNumber.from('1333333333333333333'); // 133.33%
    const marginPremium = minCollateralization.mul(ONE_SCALED).div(GLOBAL_COLLATERALIZATION).sub(ONE_SCALED);
    const liquidationSpreadPremium = BigNumber.from('400000000000000000'); // 40% --> 0.05 + (0.05 * 40%) = 0.07
    const liquidationSpread = BigNumber.from('1070000000000000000'); // 1.07
    return { marginPremium, minCollateralization, liquidationSpread, liquidationSpreadPremium };
  }

  const minCollateralization = BigNumber.from('1250000000000000000'); // 125%
  const liquidationSpread = BigNumber.from('1060000000000000000'); // 106%
  const marginPremium = minCollateralization.mul(ONE_SCALED).div(GLOBAL_COLLATERALIZATION).sub(ONE_SCALED);
  const liquidationSpreadPremium = BigNumber.from('200000000000000000'); // 20% --> 0.05 + (0.05 * 20%) = 0.06
  return { marginPremium, minCollateralization, liquidationSpread, liquidationSpreadPremium };
}

export async function getUmamiAssetVaultRegistryConstructorParams(
  core: CoreProtocol,
  implementation: UmamiAssetVaultRegistry,
): Promise<any[]> {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.umamiEcosystem.storageViewer.address,
    core.dolomiteRegistry.address,
  );
  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
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

export function getUmamiAssetVaultWithChainlinkPriceOracleConstructorParams(
  core: CoreProtocol,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiVaultIsolationModeToken: { address: address },
): any[] {
  if (!core.umamiEcosystem) {
    throw new Error('Umami ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.chainlinkRegistry!.address,
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
  umamiVaultToken: IUmamiAssetVault,
  userVaultImplementation: IUmamiAssetVaultIsolationModeTokenVaultV1 | UmamiAssetVaultIsolationModeTokenVaultV1,
): Promise<any[]> {
  if (!core.umamiEcosystem) {
    return Promise.reject(new Error('Umami ecosystem not initialized'));
  }

  return [
    umamiAssetVaultRegistry.address,
    [await core.dolomiteMargin.getMarketIdByTokenAddress(await umamiVaultToken.asset())],
    [],
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

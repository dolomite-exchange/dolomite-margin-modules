import { address } from '@dolomite-margin/dist/src';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IJonesUSDCIsolationModeTokenVaultV1,
  IJonesUSDCRegistry,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCRegistry,
} from '../../types';

export async function getJonesUSDCRegistryConstructorParams(
  implementation: JonesUSDCRegistry,
  core: CoreProtocol,
): Promise<any[]> {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.jonesEcosystem.glpAdapter.address,
    core.jonesEcosystem.glpVaultRouter.address,
    core.jonesEcosystem.whitelistController.address,
    core.jonesEcosystem.usdcReceiptToken.address,
    core.jonesEcosystem.jUSDC.address,
    core.jonesEcosystem.jUSDCFarm.address,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data!,
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

export function getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.chainlinkRegistry!.address,
    jonesUSDCRegistry.address,
    core.marketIds.usdc,
    djUSDCToken.address,
  ];
}

export function getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.tokens.usdc!.address,
    jonesUSDCRegistry.address,
    djUSDCToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(
  core: CoreProtocol,
  jonesUSDCRegistry: IJonesUSDCRegistry | JonesUSDCRegistry,
  djUSDCToken: { address: address },
): any[] {
  if (!core.jonesEcosystem) {
    throw new Error('Jones ecosystem not initialized');
  }

  return [
    core.tokens.usdc!.address,
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
    [core.marketIds.usdc],
    [],
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
    core.tokens.usdc!.address,
    jonesUSDCRegistry.address,
    djUSDCToken.address,
    core.dolomiteMargin.address,
  ];
}

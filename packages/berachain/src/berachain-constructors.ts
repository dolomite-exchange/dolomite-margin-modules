import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IBerachainRewardsRegistry,
  IInfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1,
  IPOLLiquidatorProxyV1,
  POLIsolationModeTokenVaultV1,
} from './types';

export async function getBerachainRewardsRegistryConstructorParams(
  implementation: BerachainRewardsRegistry,
  metaVaultImplementation: { address: string },
  polLiquidator: IPOLLiquidatorProxyV1,
  core: CoreProtocolBerachain,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    core.tokens.bgt.address,
    core.berachainRewardsEcosystem.bgtm.address,
    core.tokens.iBgt.address,
    core.tokens.wbera.address,
    core.berachainRewardsEcosystem.berachainRewardsFactory.address,
    core.berachainRewardsEcosystem.iBgtStakingPool.address,
    core.berachainRewardsEcosystem.infrared.address,
    metaVaultImplementation.address,
    polLiquidator.address,
    core.dolomiteRegistry.address,
  );
  return [implementation.address, core.dolomiteMargin.address, calldata.data];
}

export function getInfraredBGTIsolationModeVaultFactoryConstructorParams(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  vaultImplementation: IInfraredBGTIsolationModeTokenVaultV1 | InfraredBGTIsolationModeTokenVaultV1,
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

export function getPOLIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolBerachain,
  symbol: string,
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  dToken: { address: string },
  userVaultImplementation: POLIsolationModeTokenVaultV1,
  initialAllowableDebtMarketIds: number[],
  initialAllowableCollateralMarketIds: number[],
): any[] {
  return [
    `Dolomite Isolation: pol-${symbol}`,
    `pol-${symbol}`,
    initialAllowableDebtMarketIds,
    initialAllowableCollateralMarketIds,
    beraRegistry.address,
    dToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

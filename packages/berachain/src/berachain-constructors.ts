import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IBerachainRewardsRegistry,
  IInfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1,
  IPOLLiquidatorProxyV1, MetaVaultUpgradeableProxy__factory,
  POLIsolationModeTokenVaultV1,
} from './types';

export async function getBerachainRewardsRegistryConstructorParams(
  implementation: BerachainRewardsRegistry,
  metaVaultImplementation: { address: string },
  polLiquidator: IPOLLiquidatorProxyV1,
  core: CoreProtocolBerachain,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize({
    bgt: core.tokens.bgt.address,
    bgtm: core.berachainRewardsEcosystem.bgtm.address,
    iBgt: core.tokens.iBgt.address,
    wbera: core.tokens.wbera.address,
    berachainRewardsFactory: core.berachainRewardsEcosystem.berachainRewardsFactory.address,
    iBgtStakingVault: core.berachainRewardsEcosystem.iBgtStakingPool.address,
    infrared: core.berachainRewardsEcosystem.infrared.address,
    metaVaultImplementation: metaVaultImplementation.address,
    polLiquidator: polLiquidator.address,
    metaVaultProxyCreationCode: MetaVaultUpgradeableProxy__factory.bytecode,
    dolomiteRegistry: core.dolomiteRegistry.address,
  });
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

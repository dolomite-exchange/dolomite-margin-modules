import { BigNumberish } from 'ethers';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendleGLPRegistry,
  IPendlePtToken,
  IPendleYtToken,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendleGLPRegistry,
  IPendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleWstETHRegistry,
  IPendleWstETHRegistry,
  IPendlePtWstETHIsolationModeTokenVaultV1,
  PendlePtWstETHIsolationModeTokenVaultV1,
  IPendlePtWstETHIsolationModeVaultFactory,
  PendlePtWstETHIsolationModeVaultFactory,
  PendleRETHRegistry,
  IPendleRETHRegistry,
  PendlePtRETHIsolationModeVaultFactory,
  IPendlePtRETHIsolationModeVaultFactory,
} from '../../types';

export function getPendlePtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dptGlp.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getPendlePtWstETHPriceOracleConstructorParams(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dptWstEth.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.wstEth!,
  ];
}

export async function getPendleGLPRegistryConstructorParams(
  implementation: PendleGLPRegistry,
  core: CoreProtocol,
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    core.pendleEcosystem!.ptGlpMarket.address,
    core.pendleEcosystem!.ptGlpToken.address,
    core.pendleEcosystem!.ptOracle.address,
    core.pendleEcosystem!.syGlpToken.address,
    core.pendleEcosystem!.ytGlpToken.address,
    core.dolomiteRegistry.address
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data
  ];
}

export async function getPendleWstETHRegistryConstructorParams(
  implementation: PendleWstETHRegistry,
  core: CoreProtocol
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    core.pendleEcosystem!.ptWstEth2024Market.address,
    core.pendleEcosystem!.ptWstEth2024Token.address,
    core.pendleEcosystem!.ptWstEth2025Market.address,
    core.pendleEcosystem!.ptWstEth2025Token.address,
    core.pendleEcosystem!.ptOracle.address,
    core.pendleEcosystem!.syWstEthToken.address,
    core.dolomiteRegistry.address
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data
  ];
}

export async function getPendleRETHRegistryConstructorParams(
  implementation: PendleRETHRegistry,
  core: CoreProtocol
): Promise<any[]> {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.pendleEcosystem!.pendleRouter.address,
    core.pendleEcosystem!.ptRETHMarket.address,
    core.pendleEcosystem!.ptRETHToken.address,
    core.pendleEcosystem!.ptOracle.address,
    core.pendleEcosystem!.syRETHToken.address,
    core.dolomiteRegistry.address
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data
  ];
}

export function getPendlePtRETHIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  registry: IPendleRETHRegistry | PendleRETHRegistry,
  ptRETHToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLP2024IsolationModeTokenVaultV1 | PendlePtGLP2024IsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    registry.address,
    ptRETHToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtRETHPriceOracleConstructorParams(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dptRETH.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.rEth!,
  ];
}

export function getPendlePtRETHIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.tokens.rEth!.address,
    dptRETH.address,
    core.dolomiteMargin.address
  ];
}

export function getPendlePtRETHIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.tokens.rEth!.address,
    dptRETH.address,
    core.dolomiteMargin.address
  ];
}

export function getPendlePtWstETHIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  registry: IPendleWstETHRegistry | PendleWstETHRegistry,
  ptWstEthToken: IPendlePtToken,
  userVaultImplementation: IPendlePtWstETHIsolationModeTokenVaultV1 | PendlePtWstETHIsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    registry.address,
    ptWstEthToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtWstETHIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.tokens.wstEth!.address,
    dptWstEth.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtWstETHIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.tokens.wstEth!.address,
    dptWstEth.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dptGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  ptGlpToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLP2024IsolationModeTokenVaultV1 | PendlePtGLP2024IsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    ptGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLP2024IsolationModeTokenVaultV1 | PendleYtGLP2024IsolationModeTokenVaultV1,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    core.tokens.weth.address,
    core.marketIds.weth,
    pendleRegistry.address,
    debtMarketIds,
    collateralMarketIds,
    ytGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dptGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dytGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    pendleRegistry.address,
    core.gmxEcosystem!.live.gmxRegistry.address,
    dytGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getPendleYtGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): any[] {
  if (!core.pendleEcosystem) {
    throw new Error('Pendle ecosystem not initialized');
  }

  return [
    dytGlp.address,
    pendleRegistry.address,
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
  ];
}

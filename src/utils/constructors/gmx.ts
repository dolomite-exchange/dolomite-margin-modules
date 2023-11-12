import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocol } from '../../../test/utils/setup';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeVaultFactory,
  GmxRegistryV1,
  GmxV2Registry,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGLPIsolationModeTokenVaultV1,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGmxMarketToken,
  IGmxRegistryV1,
  IGmxV2Registry,
  IGmxV2IsolationModeVaultFactory,
  TestGLPIsolationModeTokenVaultV1,
} from '../../types';

export function getGLPPriceOracleV1ConstructorParams(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [gmxRegistry.address, dfsGlp.address];
}

export function getGLPUnwrapperTraderV1ConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.tokens.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export type GmxUserVaultImplementation =
  IGLPIsolationModeTokenVaultV1
  | GLPIsolationModeTokenVaultV1
  | TestGLPIsolationModeTokenVaultV1;

export function getGLPIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): any[] {
  return [
    core.tokens.weth.address,
    core.marketIds.weth,
    gmxRegistry.address,
    core.gmxEcosystem!.fsGlp.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPWrapperTraderV1ConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    core.tokens.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export function getGLPWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): any[] {
  return [
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function getGmxRegistryConstructorParams(
  implementation: GmxRegistryV1,
  core: CoreProtocol,
): Promise<any[]> {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  const initializer = {
    esGmx: core.gmxEcosystem.esGmx.address,
    fsGlp: core.gmxEcosystem.fsGlp.address,
    glp: core.gmxEcosystem.glp.address,
    glpManager: core.gmxEcosystem.glpManager.address,
    glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
    gmx: core.gmxEcosystem.gmx.address,
    gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
    gmxVault: core.gmxEcosystem.gmxVault.address,
    sGlp: core.gmxEcosystem.sGlp.address,
    sGmx: core.gmxEcosystem.sGmx.address,
    sbfGmx: core.gmxEcosystem.sbfGmx.address,
    vGlp: core.gmxEcosystem.vGlp.address,
    vGmx: core.gmxEcosystem.vGmx.address,
  };

  return [
    implementation.address,
    core.dolomiteMargin.address,
    (await implementation.populateTransaction.initialize(initializer, core.dolomiteRegistry.address)).data!,
  ];
}

export async function getGmxV2RegistryConstructorParams(
  core: CoreProtocol,
  implementation: GmxV2Registry,
  callbackGasLimit: BigNumberish,
): Promise<any[]> {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.gmxEcosystemV2!.gmxDataStore.address,
    core.gmxEcosystemV2!.gmxDepositVault.address,
    core.gmxEcosystemV2!.gmxExchangeRouter.address,
    core.gmxEcosystemV2!.gmxReader.address,
    core.gmxEcosystemV2!.gmxRouter.address,
    core.gmxEcosystemV2!.gmxWithdrawalVault.address,
    callbackGasLimit,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export const GMX_V2_EXECUTION_FEE = parseEther('0.0075');
export const GMX_V2_CALLBACK_GAS_LIMIT = BigNumber.from('2000000');

export function getGmxV2IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: IGmxMarketToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('Gmx ecosystem not initialized');
  }

  return [
    gmxRegistry.address,
    GMX_V2_EXECUTION_FEE,
    [
      gmToken.address,
      core.tokens.weth.address,
      core.tokens.nativeUsdc!.address,
      core.tokens.weth.address,
    ],
    debtMarketIds,
    collateralMarketIds,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export async function getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  implementation: GmxV2IsolationModeUnwrapperTraderV2,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxV2Registry | GmxV2Registry,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGM.address,
    core.dolomiteMargin.address,
    gmxRegistryV2.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export async function getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocol,
  implementation: GmxV2IsolationModeWrapperTraderV2,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxV2Registry | GmxV2Registry,
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGM.address,
    core.dolomiteMargin.address,
    gmxRegistryV2.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getGmxV2MarketTokenPriceOracleConstructorParams(
  core: CoreProtocol,
  gmxRegistryV2: IGmxV2Registry | GmxV2Registry,
): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('Gmx ecosystem not initialized');
  }

  return [
    gmxRegistryV2.address,
    core.dolomiteMargin.address,
  ];
}

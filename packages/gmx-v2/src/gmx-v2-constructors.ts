import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocol } from '../../base/test/utils/setup';
import {
  GmxV2Registry,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
  IGmxV2Registry,
  IGmxV2IsolationModeVaultFactory,
} from './types';

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

export const GMX_V2_EXECUTION_FEE = BigNumber.from('13627562862500000');
export const GMX_V2_CALLBACK_GAS_LIMIT = BigNumber.from('2000000');

export function getGmxV2IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocol,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: IGmxMarketToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
  executionFee: BigNumberish,
): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('Gmx ecosystem not initialized');
  }

  return [
    gmxRegistry.address,
    executionFee,
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

import { GmToken } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/gmx';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Registry,
  IGmxV2IsolationModeVaultFactory,
  IGmxV2Registry,
} from './types';

export async function getGmxV2RegistryConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GmxV2Registry,
  callbackGasLimit: BigNumberish,
): Promise<any[]> {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.gmxV2Ecosystem!.gmxDataStore.address,
    core.gmxV2Ecosystem!.gmxDepositVault.address,
    core.gmxV2Ecosystem!.gmxExchangeRouter.address,
    core.gmxV2Ecosystem!.gmxReader.address,
    core.gmxV2Ecosystem!.gmxRouter.address,
    core.gmxV2Ecosystem!.gmxWithdrawalVault.address,
    callbackGasLimit,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export const GLV_EXECUTION_FEE_FOR_TESTS = parseEther('0.05');
export const GLV_CALLBACK_GAS_LIMIT = BigNumber.from(4_000_000);
export const GMX_V2_EXECUTION_FEE = parseEther('0.001');
export const GMX_V2_EXECUTION_FEE_FOR_TESTS = parseEther('0.015');
export const GMX_V2_CALLBACK_GAS_LIMIT = BigNumber.from(3_000_000);

export function getGmxV2IsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolArbitrumOne,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: GmToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
  executionFee: BigNumberish,
  skipLongToken: boolean
): any[] {
  return [
    {
      gmxV2Registry: gmxRegistry.address,
      executionFee: BigNumber.from(executionFee),
      tokenAndMarketAddresses: {
        marketToken: gmToken.marketToken.address,
        indexToken: gmToken.indexToken.address,
        shortToken: gmToken.shortToken.address,
        longToken: gmToken.longToken.address,
      },
      skipLongToken: skipLongToken,
      initialAllowableDebtMarketIds: debtMarketIds,
      initialAllowableCollateralMarketIds: collateralMarketIds,
      borrowPositionProxyV2: core.borrowPositionProxyV2.address,
      userVaultImplementation: userVaultImplementation.address,
      dolomiteRegistry: core.dolomiteRegistry.address,
      dolomiteMargin: core.dolomiteMargin.address,
    }
  ];
}

export async function getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GmxV2IsolationModeUnwrapperTraderV2,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxV2Registry | GmxV2Registry,
  skipLongToken: boolean
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGM.address,
    core.dolomiteMargin.address,
    gmxRegistryV2.address,
    skipLongToken
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export async function getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GmxV2IsolationModeWrapperTraderV2,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxV2Registry | GmxV2Registry,
  skipLongToken: boolean
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGM.address,
    core.dolomiteMargin.address,
    gmxRegistryV2.address,
    skipLongToken
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getGmxV2MarketTokenPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
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

export function getGmxV2IsolationModeTokenVaultConstructorParams(
  core: CoreProtocolArbitrumOne,
): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('Gmx ecosystem not initialized');
  }

  return [core.tokens.weth.address, core.config.network];
}

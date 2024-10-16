import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvRegistry,
  IGlvIsolationModeVaultFactory,
  IGlvRegistry,
} from './types';
import { BigNumber, BigNumberish } from 'ethers';
import { GlvToken } from 'packages/base/test/utils/ecosystem-utils/glv';
import { IGmxMarketToken } from 'packages/gmx-v2/src/types';

export async function getGlvRegistryConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GlvRegistry,
  callbackGasLimit: BigNumberish,
): Promise<any[]> {
  if (!core.gmxEcosystem || !core.glvEcosystem) {
    throw new Error('GMX/GLV ecosystem not initialized');
  }

  const calldata = await implementation.populateTransaction.initialize(
    core.gmxV2Ecosystem!.gmxDataStore.address,
    core.gmxV2Ecosystem!.gmxExchangeRouter.address,
    core.gmxV2Ecosystem!.gmxReader.address,
    core.glvEcosystem!.glvHandler.address,
    core.glvEcosystem!.glvReader.address,
    core.glvEcosystem!.glvRouter.address,
    core.glvEcosystem!.glvVault.address,
    callbackGasLimit,
    core.dolomiteRegistry.address,
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getGlvIsolationModeTokenVaultConstructorParams(
  core: CoreProtocolArbitrumOne,
): any[] {
  if (!core.gmxEcosystem || !core.glvEcosystem) {
    throw new Error('Gmx/Glv ecosystem not initialized');
  }

  return [core.tokens.weth.address, core.config.network];
}

export function getGlvIsolationModeVaultFactoryConstructorParams(
  core: CoreProtocolArbitrumOne,
  glvRegistry: IGlvRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  glvToken: GlvToken,
  userVaultImplementation: GlvIsolationModeTokenVaultV1,
  executionFee: BigNumberish,
  skipLongToken: boolean
): any[] {
  return [
    {
      glvRegistry: glvRegistry.address,
      executionFee: BigNumber.from(executionFee),
      tokenAndMarketAddresses: {
        glvToken: glvToken.glvToken.address,
        longToken: glvToken.longToken.address,
        shortToken: glvToken.shortToken.address,
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

export async function getGlvIsolationModeUnwrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GlvIsolationModeUnwrapperTraderV2,
  dGlv: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  glvRegistry: IGlvRegistry | GlvRegistry,
  skipLongToken: boolean
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGlv.address,
    core.dolomiteMargin.address,
    glvRegistry.address,
    skipLongToken
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export async function getGlvIsolationModeWrapperTraderV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  implementation: GlvIsolationModeWrapperTraderV2,
  dGlv: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  glvRegistry: IGlvRegistry | GlvRegistry,
  skipLongToken: boolean
): Promise<any[]> {
  const calldata = await implementation.populateTransaction.initialize(
    dGlv.address,
    core.dolomiteMargin.address,
    glvRegistry.address,
    skipLongToken
  );

  return [
    implementation.address,
    core.dolomiteMargin.address,
    calldata.data,
  ];
}

export function getGlvTokenPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  factory: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  glvRegistry: IGlvRegistry | GlvRegistry,
): any[] {
  if (!core.glvEcosystem || !core.gmxEcosystem) {
    throw new Error('GLV/GMX ecosystem not initialized');
  }

  return [
    factory.address,
    glvRegistry.address,
    core.dolomiteMargin.address,
  ];
}

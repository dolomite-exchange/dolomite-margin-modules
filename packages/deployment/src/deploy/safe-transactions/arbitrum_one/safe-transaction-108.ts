import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  getChainlinkPriceOracleV1ConstructorParamsFromOldPriceOracle,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { getPendleYtGLPPriceOracleConstructorParams } from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { IPendleYtGLPMar2024IsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-pendle/src/types';
import { BigNumber } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new YT-GLP price oracle and sets it for dYT-GLP
 * - Sets the price new Chainlink Price Oracle on all the markets that used the old Chainlink Price Oracle.
 * - Sets the Chainlink Price Automation oracles on jUSDC, mGLP, and plvGLP
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const chainlinkPriceOracleParams = await getChainlinkPriceOracleV1ConstructorParamsFromOldPriceOracle(core);
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    'ChainlinkPriceOracle',
    chainlinkPriceOracleParams,
    'ChainlinkPriceOracleV1',
  );
  const pendleYtGlpPriceOracleAddress = await deployContractAndSave(
    'PendleYtGLPPriceOracle',
    getPendleYtGLPPriceOracleConstructorParams(
      core,
      IPendleYtGLPMar2024IsolationModeVaultFactory__factory.connect(core.tokens.dYtGlp!.address, core.hhUser1),
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
  );

  const tokens = chainlinkPriceOracleParams[0];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token);
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [marketId, chainlinkPriceOracleAddress],
    );
  }

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.dYtGlp!, pendleYtGlpPriceOracleAddress],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.magicGlp!, Deployments.MagicGLPWithChainlinkAutomationPriceOracle[network].address],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.dplvGlp!, Deployments.PlutusVaultGLPWithChainlinkAutomationPriceOracle[network].address],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.djUsdcOld!, Deployments.JonesUSDCWithChainlinkAutomationPriceOracleV1[network].address],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactoryOld',
    'ownerSetAllowableDebtMarketIds',
    [await appendNativeUsdcToDebtMarketIdList(core, core.jonesEcosystem!.live.jUSDCIsolationModeFactoryOld)],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactoryOld',
    'ownerSetAllowableCollateralMarketIds',
    [await appendNativeUsdcToCollateralMarketIdList(core, core.jonesEcosystem!.live.jUSDCIsolationModeFactoryOld)],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.pendleEcosystem!.glpMar2024,
    'dYtGlpMar2024',
    'ownerSetAllowableDebtMarketIds',
    [await appendNativeUsdcToDebtMarketIdList(core, core.pendleEcosystem!.glpMar2024.dYtGlpMar2024)],
  );
}

async function appendNativeUsdcToDebtMarketIdList(
  core: CoreProtocolArbitrumOne,
  factory: { allowableDebtMarketIds: () => Promise<BigNumber[]> },
): Promise<BigNumber[]> {
  const oldMarketIds = await factory.allowableDebtMarketIds();
  return oldMarketIds.concat(BigNumber.from(core.marketIds.nativeUsdc!));
}

async function appendNativeUsdcToCollateralMarketIdList(
  core: CoreProtocolArbitrumOne,
  factory: { allowableCollateralMarketIds: () => Promise<BigNumber[]> },
): Promise<BigNumber[]> {
  const oldMarketIds = await factory.allowableCollateralMarketIds();
  return oldMarketIds.concat(BigNumber.from(core.marketIds.nativeUsdc!));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { BigNumber } from 'ethers';
import { IPendleYtGLP2024IsolationModeVaultFactory__factory } from '../../../../src/types';
import { getChainlinkPriceOracleParams } from '../../../../src/utils/constructors/oracles';
import { getPendleYtGLPPriceOracleConstructorParams } from '../../../../src/utils/constructors/pendle';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../deploy-utils';
import * as Deployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys the new YT-GLP price oracle and sets it for dYT-GLP
 * - Sets the price new Chainlink Price Oracle on all the markets that used the old Chainlink Price Oracle.
 * - Sets the Chainlink Price Automation oracles on jUSDC, mGLP, and plvGLP
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const chainlinkPriceOracleParams = await getChainlinkPriceOracleParams(core);
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'ChainlinkPriceOracle',
    chainlinkPriceOracleParams,
  );
  const pendleYtGlpPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLPPriceOracle',
    getPendleYtGLPPriceOracleConstructorParams(
      core,
      IPendleYtGLP2024IsolationModeVaultFactory__factory.connect(core.tokens.dYtGlp!.address, core.hhUser1),
      core.pendleEcosystem!.live.pendleGLP2024Registry,
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
    [core.marketIds.djUSDC!, Deployments.JonesUSDCWithChainlinkAutomationPriceOracle[network].address],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactory',
    'ownerSetAllowableDebtMarketIds',
    [await appendNativeUsdcToDebtMarketIdList(core, core.jonesEcosystem!.live.jUSDCIsolationModeFactory)],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.jonesEcosystem!.live,
    'jUSDCIsolationModeFactory',
    'ownerSetAllowableCollateralMarketIds',
    [await appendNativeUsdcToCollateralMarketIdList(core, core.jonesEcosystem!.live.jUSDCIsolationModeFactory)],
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.pendleEcosystem!.live,
    'ytGlpIsolationModeFactory',
    'ownerSetAllowableDebtMarketIds',
    [await appendNativeUsdcToDebtMarketIdList(core, core.pendleEcosystem!.live.ytGlpIsolationModeFactory)],
  );
}

async function appendNativeUsdcToDebtMarketIdList(
  core: CoreProtocol,
  factory: { allowableDebtMarketIds: () => Promise<BigNumber[]> },
): Promise<BigNumber[]> {
  const oldMarketIds = await factory.allowableDebtMarketIds();
  return oldMarketIds.concat(BigNumber.from(core.marketIds.nativeUsdc!));
}

async function appendNativeUsdcToCollateralMarketIdList(
  core: CoreProtocol,
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

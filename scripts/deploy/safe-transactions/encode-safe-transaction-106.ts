import { ethers } from 'hardhat';
import { Network } from '../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Adds native USDC as a supported network on Arbitrum
 * - Increases the PT-GLP supply cap to 1M units
 */
async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const chainlinkPriceOracleOld = core.chainlinkPriceOracleOld!;
  const bridgedUsdc = core.tokens.usdc!;
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    { chainlinkPriceOracleOld },
    'chainlinkPriceOracleOld',
    'insertOrUpdateOracleToken',
    [
      core.tokens.nativeUsdc!.address,
      await chainlinkPriceOracleOld.tokenToDecimalsMap(bridgedUsdc.address),
      await chainlinkPriceOracleOld.tokenToAggregatorMap(bridgedUsdc.address),
      await chainlinkPriceOracleOld.tokenToAggregatorDecimalsMap(bridgedUsdc.address),
      await chainlinkPriceOracleOld.tokenToPairingMap(bridgedUsdc.address),
    ],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

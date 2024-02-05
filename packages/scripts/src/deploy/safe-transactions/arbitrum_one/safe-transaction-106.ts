import { CHAINLINK_PRICE_ORACLE_OLD_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { IChainlinkPriceOracleOld__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Adds native USDC as a supported network on Arbitrum
 * - Increases the PT-GLP supply cap to 1M units
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const chainlinkPriceOracleOld = IChainlinkPriceOracleOld__factory.connect(
    CHAINLINK_PRICE_ORACLE_OLD_MAP[core.config.network]!,
    core.hhUser1,
  );
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

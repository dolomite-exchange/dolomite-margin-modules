import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { formatEther } from 'ethers/lib/utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  await encodeReportCard(
    core,
    [
      core.chainlinkPriceOracleV3,
      core.redstonePriceOracleV3,
      core.chroniclePriceOracleV3,
      core.constantPriceOracle,
      core.erc4626Oracle,
      core.twapPriceOracleV3,
    ],
  );

  const transactions: EncodedTransaction[] = [];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.dolo);

      const doloUsdcPrice = await core.twapPriceOracleV3.getPrice(core.tokens.dolo.address);
      console.log(`\tDOLO/USDC price: $${formatEther(doloUsdcPrice.value)}`);
    },
  };
}

doDryRunAndCheckDeployment(main);

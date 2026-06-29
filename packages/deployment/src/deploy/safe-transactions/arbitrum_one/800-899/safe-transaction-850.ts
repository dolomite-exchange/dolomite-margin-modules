import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TestPriceOracleForAdmin__factory } from '../../../../../../base/src/types';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust caps for some assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const testPriceOracle = TestPriceOracleForAdmin__factory.connect(
    ModuleDeployments.TestPriceOracleForAdmin[network].address,
    core.hhUser1,
  );
  await encodeReportCard(core, [
    testPriceOracle,
    core.constantPriceOracle,
    core.chroniclePriceOracleV3,
    core.chainlinkPriceOracleV3,
    core.gmxV2Ecosystem.live.priceOracle,
    core.redstonePriceOracleV3,
  ]);

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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

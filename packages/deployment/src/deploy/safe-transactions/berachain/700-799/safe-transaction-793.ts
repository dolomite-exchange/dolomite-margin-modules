import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ERC4626PriceOracle__factory } from 'packages/oracles/src/types';
import { TestPriceOracleForAdmin__factory } from '../../../../../../base/src/types';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust caps for some assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const erc4626PriceOracle = ERC4626PriceOracle__factory.connect(
    ModuleDeployments.ERC4626PriceOracleV1[network].address,
    core.hhUser1,
  );
  const testPriceOracle = TestPriceOracleForAdmin__factory.connect(
    ModuleDeployments.TestPriceOracleForAdmin[network].address,
    core.hhUser1,
  );
  await encodeReportCard(
    core,
    [
      erc4626PriceOracle,
      testPriceOracle,
      core.constantPriceOracle,
      core.chroniclePriceOracleV3,
      core.chainlinkPriceOracleV3,
      core.redstonePriceOracleV3,
      core.twapPriceOracleV3,
    ],
    core.twapPriceOracleV3,
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

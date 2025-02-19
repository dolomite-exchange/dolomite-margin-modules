import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lowers the supply cap of BERA, USD0, and USD0++ to 1 unit
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(await encodeSetSupplyCap(core, core.marketIds.wbera, ONE_BI));
  transactions.push(await encodeSetSupplyCap(core, core.marketIds.usd0, ONE_BI));
  transactions.push(await encodeSetSupplyCap(core, core.marketIds.usd0pp, ONE_BI));
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
      await checkSupplyCap(core, core.marketIds.wbera, ONE_BI);
      await checkSupplyCap(core, core.marketIds.usd0, ONE_BI);
      await checkSupplyCap(core, core.marketIds.usd0pp, ONE_BI);
    },
  };
}

doDryRunAndCheckDeployment(main);

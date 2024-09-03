import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, EncodedTransaction } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { getOogaBoogaAggregatorTraderConstructorParams } from 'packages/base/src/utils/constructors/traders';


/**
 * This script encodes the following transactions:
 * - Deploys the OogaBoogaAggregatorTrader
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  await deployContractAndSave(
    'OogaBoogaAggregatorTrader',
    getOogaBoogaAggregatorTraderConstructorParams(core)
  );

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
    },
  };
}

doDryRunAndCheckDeployment(main);

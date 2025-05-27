import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetInterestSetter } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkInterestSetter } from '../../../../utils/invariant-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Create the BerachainRewardsReader
 * - Update the Infrared meta vault + registry to expose new functions
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const interestSetter = core.interestSetters.linearStepFunction16L84U90OInterestSetter;
  const transactions: EncodedTransaction[] = [
    await encodeSetInterestSetter(core, core.marketIds.rUsd, interestSetter),
  ];

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
      await checkInterestSetter(core, core.marketIds.rUsd, interestSetter);
    },
  };
}

doDryRunAndCheckDeployment(main);

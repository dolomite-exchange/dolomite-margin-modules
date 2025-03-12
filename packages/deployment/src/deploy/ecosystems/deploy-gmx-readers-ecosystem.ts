import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  getEsGmxReaderConstructorParams,
  getStakedGmxReaderConstructorParams,
} from 'packages/glp/src/glp-constructors';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

type AcceptableNetworks = Network.ArbitrumOne;

/**
 * This script encodes the following transactions:
 * - Deploys the esGMX and sGMX reader contracts for GMX gov
 */
async function main(): Promise<DryRunOutput<AcceptableNetworks>> {
  const rawNetwork = await getAnyNetwork();
  if (rawNetwork !== Network.ArbitrumOne) {
    return Promise.reject(new Error(`Invalid network: ${rawNetwork}`));
  }
  const network = rawNetwork as AcceptableNetworks;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  await deployContractAndSave('EsGmxReader', getEsGmxReaderConstructorParams(core.gmxEcosystem.live.dGlp));
  await deployContractAndSave('StakedGmxReader', getStakedGmxReaderConstructorParams(core.gmxEcosystem.live.dGlp));

  const transactions: EncodedTransaction[] = [];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

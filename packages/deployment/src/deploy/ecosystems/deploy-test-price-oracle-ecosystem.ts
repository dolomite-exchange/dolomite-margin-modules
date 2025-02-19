import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the test price oracle
 */
async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  await deployContractAndSave('TestPriceOracle', []);
  await deployContractAndSave('TestPriceOracleForAdmin', [core.dolomiteMargin.address]);

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

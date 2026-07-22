import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { IDolomitePriceOracle__factory } from '../../../../../../base/src/types';
import { IERC20__factory } from '../../../../../../gamma/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists qRWA market
 */
async function main(): Promise<DryRunOutput<Network.Sepolia>> {
  const network = await getAndCheckSpecificNetwork(Network.Sepolia);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const qRwaToken = IERC20__factory.connect('0x8af353be0FefF7bb19414682e168882291beeE8f', core.hhUser1);
  const rwaOracle = IDolomitePriceOracle__factory.connect('0x87C24C77f9606D9afb006766b41B5f6E3d585921', core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(...(await encodeInsertOracle(core, qRwaToken, rwaOracle, undefined)));
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      await printPriceForVisualCheck(core, qRwaToken);
    },
  };
}

doDryRunAndCheckDeployment(main);

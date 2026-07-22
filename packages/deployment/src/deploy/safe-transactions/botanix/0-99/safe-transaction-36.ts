import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCap,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Lowers caps for each market
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const markets = [
    core.marketIds.usdc,
    core.marketIds.pbtc,
    core.marketIds.weth,
    core.marketIds.stBtc,
    core.marketIds.usdt,
  ];

  const transactions: EncodedTransaction[] = [];
  for (const market of markets) {
    transactions.push(
      await encodeSetSupplyCap(core, market, ONE_BI),
      await encodeSetBorrowCap(core, market, ONE_BI),
      await encodeSetIsCollateralOnly(core, market, true),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
    },
  };
}

doDryRunAndCheckDeployment(main);

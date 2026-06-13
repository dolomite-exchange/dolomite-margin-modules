import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust solvBTC and uniBTC to be reduce-only mode for open debt
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const markets = [];
  const marketCount = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; i < marketCount.toNumber(); i += 1) {
    const collateralOnly = await core.dolomiteMargin.getMarketIsClosing(i);
    console.log('Borrow details: ', i, collateralOnly);
    if (!collateralOnly) {
      markets.push(i);
    }
  }

  const transactions: EncodedTransaction[] = [];
  for (const market of markets) {
    transactions.push(await encodeSetSupplyCap(core, market, ONE_BI));
  }

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

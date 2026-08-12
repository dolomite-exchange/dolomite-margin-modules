import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { IERC20Metadata__factory } from '../../../../../../gamma/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
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

  const markets = [];
  const marketCount = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; i < marketCount.toNumber(); i += 1) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(i);
    const decimals = await IERC20Metadata__factory.connect(token, core.hhUser1).decimals();

    const index = await core.dolomiteMargin.getMarketCurrentIndex(i);
    if (!index.supply.eq(ONE_ETH_BI) && decimals < 18) {
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

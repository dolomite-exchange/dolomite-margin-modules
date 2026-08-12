import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCap,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChainlinkOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the modular interest setter
 * - Loops through current dolomite markets, retrieves settings, and sets up the modular interest setter
 */
async function main(): Promise<DryRunOutput<Network.PolygonZkEvm>> {
  const network = await getAndCheckSpecificNetwork(Network.PolygonZkEvm);
  const core = await setupCoreProtocol({
    network,
    blockNumber: (await getRealLatestBlockNumber(true, network)) + 32,
  });

  const tx = await core.ownerAdapterV2.transactions(74);
  console.log('\ttx: ', tx);

  const transactions: EncodedTransaction[] = [
    await encodeInsertChainlinkOracle(core, core.tokens.matic, undefined, undefined, { ignoreDescription: true }),
  ];

  const allMarkets = [
    core.marketIds.weth,
    core.marketIds.usdc,
    core.marketIds.dai,
    core.marketIds.link,
    core.marketIds.matic,
    core.marketIds.pol,
    core.marketIds.usdt,
    core.marketIds.wbtc,
  ];
  for (const market of allMarkets) {
    transactions.push(
      await encodeSetSupplyCap(core, market, ONE_BI),
      await encodeSetBorrowCap(core, market, ONE_BI),
      await encodeSetIsCollateralOnly(core, market, true),
    );
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
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.matic);
    },
  };
}

doDryRunAndCheckDeployment(main);

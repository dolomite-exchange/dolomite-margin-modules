import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, encodeSimpleBoycoListing } from '../utils';

const BTC_PRICE_8D = '1050000000000000000000000000000000'; // $105k
const ETH_PRICE = parseEther(`${3_400}`); // $3,400

/**
 * This script encodes the following transactions:
 * - Lists the fourth batch of Boyco markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeSimpleBoycoListing(core, core.tokens.eBtc, BTC_PRICE_8D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.weEth, ETH_PRICE)),
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
      await checkMarket(core, core.marketIds.usd0, core.tokens.eBtc);
      await checkMarket(core, core.marketIds.usd0pp, core.tokens.weEth);
    },
  };
}

doDryRunAndCheckDeployment(main);

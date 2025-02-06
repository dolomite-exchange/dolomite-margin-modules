import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, encodeSimpleBoycoListing } from '../utils';

const STABLE_COIN_PRICE_18D = parseEther(`${1}`);

/**
 * This script encodes the following transactions:
 * - Lists third batch of Boyco markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeSimpleBoycoListing(core, core.tokens.usd0, STABLE_COIN_PRICE_18D)),
    ...(await encodeSimpleBoycoListing(core, core.tokens.usd0pp, STABLE_COIN_PRICE_18D)),
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
      await checkMarket(core, core.marketIds.usd0, core.tokens.usd0);
      await checkMarket(core, core.marketIds.usd0pp, core.tokens.usd0pp);
    },
  };
}

doDryRunAndCheckDeployment(main);

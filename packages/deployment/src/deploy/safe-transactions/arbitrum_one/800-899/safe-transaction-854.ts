import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeExpirePositions } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Expire RDNT positions
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const positions = await import('./borrow-27-accounts.json');
  const expirations = positions.default.map((p) => ({
    account: p,
    owedMarkets: [core.marketIds.radiant],
    expirationTimestamp: 1784646900, // Tue Jul 21 2026 15:15:00 GMT+0000
  }));
  const transactions: EncodedTransaction[] = [await encodeExpirePositions(core, expirations)];

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
    },
  };
}

doDryRunAndCheckDeployment(main);

import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Changes the timelock to 15 seconds
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapter: core.ownerAdapterV1 },
      'ownerAdapter',
      'ownerSetSecondsTimeLocked',
      [15],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapter: core.ownerAdapterV1 },
      'ownerAdapter',
      'grantRole',
      [await core.ownerAdapterV1.DEFAULT_ADMIN_ROLE(), core.gnosisSafeAddress],
    ),
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
      assertHardhatInvariant(await core.ownerAdapterV1.secondsTimeLocked() === 15, 'Invalid seconds time locked');
    },
  };
}

doDryRunAndCheckDeployment(main);

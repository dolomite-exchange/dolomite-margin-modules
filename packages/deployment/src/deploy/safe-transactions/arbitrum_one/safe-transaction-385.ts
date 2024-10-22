import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the new GenericTraderProxy on the Dolomite Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteRegistry', 'ownerSetGenericTraderProxy', [
      core.genericTraderProxy.address,
    ]),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteRegistry.genericTraderProxy()) === core.genericTraderProxy.address,
        'Invalid generic trader proxy',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

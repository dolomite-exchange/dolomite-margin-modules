import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const callbackGasLimit = 2_500_000;

/**
 * This script encodes the following transactions:
 * - Removes the funky selector as instant on the factories
 * - Allows ownerSetUserVaultImplementation to be called instantly on the factory
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const registry = core.gmxV2Ecosystem.live.registry;

  const callbackGasLimitTransaction = await registry.populateTransaction.ownerSetCallbackGasLimit(callbackGasLimit);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry },
      'registry',
      'ownerSetCallbackGasLimit',
      [callbackGasLimit],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { multisig: core.delayedMultiSig },
      'multisig',
      'setSelector',
      [registry.address, callbackGasLimitTransaction.data!.substring(0, 10), true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
  };
}

doDryRunAndCheckDeployment(main);

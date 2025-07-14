import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { RegistryProxy__factory } from '../../../../../../base/src/types';
import { ModuleDeployments } from '../../../../utils';
import { deployContractAndSave, getMaxDeploymentVersionAddressByDeploymentKey } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the implementation for the 4626 tokens
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  for (const token of core.dolomiteTokens.all) {
    let implementationAddress: string;
    if ('depositFromPayable' in token) {
      implementationAddress = core.dolomiteTokens.payableImplementationAddress;
    } else {
      implementationAddress = core.dolomiteTokens.implementationAddress;
    }

    const tokenProxy = RegistryProxy__factory.connect(token.address, core.hhUser1);
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { tokenProxy },
        'tokenProxy',
        'upgradeTo',
        [implementationAddress],
      )
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

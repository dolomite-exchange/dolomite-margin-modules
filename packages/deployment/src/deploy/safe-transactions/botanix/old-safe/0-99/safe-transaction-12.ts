import { getAndCheckSpecificNetwork } from '../../../../../../../base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network } from '../../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate } from '../../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../../utils/get-script-name';

const NEW_OWNER = '0xa75c21C5BE284122a87A37a76cc6C4DD3E55a1D4';

/**
 * This script encodes the following transactions:
 * - Updates the owner to the real multisig
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'ownerAdapterV2', 'grantRole', [BYTES_ZERO, NEW_OWNER]),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      const owner = await impersonate(NEW_OWNER, true);
      await core.ownerAdapterV2.connect(owner).submitTransaction(core.ownerAdapterV2.address, core.gnosisSafeAddress);
    },
  };
}

doDryRunAndCheckDeployment(main);

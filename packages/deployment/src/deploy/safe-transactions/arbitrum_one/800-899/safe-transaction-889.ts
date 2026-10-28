import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from '../../../../utils/deploy-utils';

/**
 * This script:
 * - updates the GMX registry
 * - Sets the handler
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const gmxRegistryImpl = await deployContractAndSave('GmxRegistryV1', [], 'GmxRegistryImplementationV2');

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.gmxEcosystem.live, 'gmxRegistryProxy', 'upgradeTo', [
      gmxRegistryImpl,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.gmxEcosystem.live, 'gmxRegistry', 'ownerSetIsHandler', [
      '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2',
      true,
    ]),
  ];

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

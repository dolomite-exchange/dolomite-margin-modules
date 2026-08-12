import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Expires all borrowers
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetGlobalOperator(core, core.adminExpirePosition.address, true),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      expect(
        await core.adminRegistry.hasPermission(
          await core.adminRegistry.ADMIN_FUNCTION_SELECTOR(),
          core.adminExpirePosition.address,
          core.gnosisSafeAddress,
        ),
      ).to.be.true;
    },
  };
}

doDryRunAndCheckDeployment(main);

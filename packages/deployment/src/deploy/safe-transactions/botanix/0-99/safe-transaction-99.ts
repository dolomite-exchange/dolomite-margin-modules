import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printRiskDataVisualCheck } from 'packages/deployment/src/utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increase the borrow cap for USDC.e
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 5_000_000),
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
      await printRiskDataVisualCheck(core, core.marketIds.usdc);
    },
  };
}

doDryRunAndCheckDeployment(main);

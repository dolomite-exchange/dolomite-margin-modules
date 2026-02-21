import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Set new risk caps
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.usda, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.sUsda, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.beraEth, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.usda, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.sUsda, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.beraEth, true),

    await encodeSetBorrowCapWithMagic(core, core.marketIds.wbera, 2_400_000),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

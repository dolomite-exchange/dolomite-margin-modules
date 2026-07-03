import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeSetBorrowCap, encodeSetSupplyCap, encodeSetSupplyCapWithMagic } from 'packages/deployment/src/utils/encoding/dolomite-margin-core-encoder-utils';
import { checkBorrowCap, checkSupplyCap } from 'packages/deployment/src/utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Set CMETH and FBTC to downsize only
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.cmEth, 1),
    await encodeSetSupplyCap(core, core.marketIds.fbtc, 1),
    await encodeSetBorrowCap(core, core.marketIds.cmEth, 1),
    await encodeSetBorrowCap(core, core.marketIds.fbtc, 1),

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
      await checkSupplyCap(core, core.marketIds.cmEth, 1);
      await checkSupplyCap(core, core.marketIds.fbtc, 1);
      await checkBorrowCap(core, core.marketIds.cmEth, 1);
      await checkBorrowCap(core, core.marketIds.fbtc, 1);
    },
  };
}

doDryRunAndCheckDeployment(main);

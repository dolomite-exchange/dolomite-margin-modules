import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCap,
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
  encodeUnpauseMarket,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust caps for some assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.iBera, parseEther(`${100_000}`)),
    await encodeSetSupplyCap(core, core.marketIds.iBgt, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.oriBgt, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.ptIBgt, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.polRUsd, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.ir, parseEther(`${10_000}`)),

    await encodeSetBorrowCap(core, core.marketIds.iBera, parseEther(`${80_000}`)),
    await encodeSetBorrowCap(core, core.marketIds.usda, ZERO_BI),

    await encodeSetIsCollateralOnly(core, core.marketIds.usda, true),

    await encodeUnpauseMarket(core, core.marketIds.lbtc),
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

import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkBorrowCap, checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Update the supply cap for srUSD and rUSD
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.srUsd, 100_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.rUsd, 100_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.rUsd, 95_000_000),
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
      await checkSupplyCap(core, core.marketIds.srUsd, parseEther(`${100_000_000}`));
      await checkSupplyCap(core, core.marketIds.rUsd, parseEther(`${100_000_000}`));
      await checkBorrowCap(core, core.marketIds.rUsd, parseEther(`${95_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

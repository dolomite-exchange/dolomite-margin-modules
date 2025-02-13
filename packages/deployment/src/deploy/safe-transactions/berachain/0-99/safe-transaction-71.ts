import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseUsdc, parseUsdt } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkBorrowCap, checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increase the caps for certain assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.sUsde, 50_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.weEth, 35_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.honey, 8_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 20_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdt, 2_000_000),
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
      await checkSupplyCap(core, core.marketIds.sUsde, parseEther(`${50_000_000}`));
      await checkSupplyCap(core, core.marketIds.weEth, parseEther(`${35_000}`));
      await checkBorrowCap(core, core.marketIds.honey, parseEther(`${8_000_000}`));
      await checkBorrowCap(core, core.marketIds.usdc, parseUsdc(`${20_000_000}`));
      await checkBorrowCap(core, core.marketIds.usdt, parseUsdt(`${2_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

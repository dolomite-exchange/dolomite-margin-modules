import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseOhm } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetBorrowCap, encodeSetIsCollateralOnly, encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { checkBorrowCap, checkIsCollateralOnly, checkSupplyCap } from 'packages/deployment/src/utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lower OHM supply cap on berachain
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.ohm, parseOhm(`${1_000}`)),
    await encodeSetBorrowCap(core, core.marketIds.ohm, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.ohm, true),
    await encodeSetSupplyCap(core, core.marketIds.weEth, ONE_BI),
    await encodeSetBorrowCap(core, core.marketIds.weEth, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.weEth, true)
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
      await checkSupplyCap(core, core.marketIds.ohm, parseOhm(`${1_000}`));
      await checkBorrowCap(core, core.marketIds.ohm, ONE_BI);
      await checkIsCollateralOnly(core, core.marketIds.ohm, true);
      await checkSupplyCap(core, core.marketIds.weEth, ONE_BI);
      await checkBorrowCap(core, core.marketIds.weEth, ONE_BI);
      await checkIsCollateralOnly(core, core.marketIds.weEth, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

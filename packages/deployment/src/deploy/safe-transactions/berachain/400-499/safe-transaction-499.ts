import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideIsBorrowOnly, checkIsCollateralOnly } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploy and set up new VeVester implementation
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions = [
    await encodeSetSupplyCap(core, core.marketIds.pumpBtc, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.ylPumpBtc, ONE_BI),
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
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.ylPumpBtc);
      await checkIsCollateralOnly(core, core.marketIds.ylPumpBtc, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

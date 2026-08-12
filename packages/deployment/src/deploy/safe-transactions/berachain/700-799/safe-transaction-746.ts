import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { printPriceForVisualCheck, } from 'packages/deployment/src/utils/invariant-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetIsBorrowOnly,
  encodeSetIsCollateralOnly, encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeInsertChronicleOracleV3,
  encodeInsertRedstoneOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust solvBTC and uniBTC to be reduce-only mode for open debt
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.xSolvBtc, ONE_BI),

    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.solvBtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.uniBtc)),

    await encodeSetIsCollateralOnly(core, core.marketIds.solvBtc, true),
    await encodeSetIsBorrowOnly(core, core.marketIds.solvBtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.uniBtc, true),
    await encodeSetIsBorrowOnly(core, core.marketIds.uniBtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.xSolvBtc, true),
    await encodeSetIsBorrowOnly(core, core.marketIds.xSolvBtc, true),
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
      await printPriceForVisualCheck(core, core.tokens.solvBtc);
      await printPriceForVisualCheck(core, core.tokens.uniBtc);
      await printPriceForVisualCheck(core, core.tokens.xSolvBtc);
    },
  };
}

doDryRunAndCheckDeployment(main);

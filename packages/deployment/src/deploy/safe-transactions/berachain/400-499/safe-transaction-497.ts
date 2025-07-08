import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CHRONICLE_PRICE_SCRIBES_MAP } from '../../../../../../base/src/utils/constants';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import {
  encodeSetIsBorrowOnly,
  encodeSetIsCollateralOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsBorrowOnly,
  checkIsCollateralOnly,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

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
    ...(await encodeInsertChronicleOracleV3(
      core,
      core.tokens.pumpBtc,
      false,
      CHRONICLE_PRICE_SCRIBES_MAP[core.network][core.tokens.wbtc.address].tokenPairAddress,
      CHRONICLE_PRICE_SCRIBES_MAP[core.network][core.tokens.wbtc.address].scribeAddress,
    )),
    await encodeSetIsBorrowOnly(core, core.marketIds.pumpBtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.pumpBtc, true),
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
      await printPriceForVisualCheck(core, core.tokens.pumpBtc);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.pumpBtc);
      await checkIsCollateralOnly(core, core.marketIds.pumpBtc, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

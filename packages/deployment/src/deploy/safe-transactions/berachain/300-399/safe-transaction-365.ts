import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployDolomiteErc4626Token } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideIsBorrowOnly, checkIsCollateralOnly } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Adds the deUSD market
 * - Adds the sdeUSD market
 * - Opens up borrowing SolvBTC and xSolvBTC
 * - Removes SolvBTC as borrowable from other BTC LSTs
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const deUsd = await deployDolomiteErc4626Token(core, 'DeUsd', core.marketIds.deUsd);
  const sdeUsd = await deployDolomiteErc4626Token(core, 'SdeUsd', core.marketIds.sdeUsd);

  const transactions: EncodedTransaction[] = [
    ...(await encodeSetupDolomite4626Token(core, deUsd)),
    ...(await encodeSetupDolomite4626Token(core, sdeUsd)),
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
      await checkIsCollateralOnly(core, core.marketIds.deUsd, true);
      await checkIsCollateralOnly(core, core.marketIds.sdeUsd, true);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.deUsd);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.sdeUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);

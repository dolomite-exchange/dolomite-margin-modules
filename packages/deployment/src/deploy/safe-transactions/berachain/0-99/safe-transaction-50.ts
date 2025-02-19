import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeTestOracleAndDisableSupply } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsCollateralOnly, checkSupplyCap, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Switches oracles and disables the markets for each token
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.rUsd, parseEther('1'))),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.wbera, parseEther('5'))),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.usd0, parseEther('1'))),
    ...(await encodeTestOracleAndDisableSupply(core, core.tokens.usd0pp, parseEther('1'))),
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
      await printPriceForVisualCheck(core, core.tokens.rUsd);
      await printPriceForVisualCheck(core, core.tokens.wbera);
      await printPriceForVisualCheck(core, core.tokens.usd0);
      await printPriceForVisualCheck(core, core.tokens.usd0pp);

      await checkSupplyCap(core, core.marketIds.rUsd, ONE_BI);
      await checkSupplyCap(core, core.marketIds.wbera, ONE_BI);
      await checkSupplyCap(core, core.marketIds.usd0, ONE_BI);
      await checkSupplyCap(core, core.marketIds.usd0pp, ONE_BI);

      await checkIsCollateralOnly(core, core.marketIds.rUsd, true);
      await checkIsCollateralOnly(core, core.marketIds.wbera, true);
      await checkIsCollateralOnly(core, core.marketIds.usd0, true);
      await checkIsCollateralOnly(core, core.marketIds.usd0pp, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

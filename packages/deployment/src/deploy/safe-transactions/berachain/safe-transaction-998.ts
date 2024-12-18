import { TestPriceOracle__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Sets WETH's price oracle to the test oracle
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  if (network === '80084') {
    const testPriceOracle = TestPriceOracle__factory.connect(
      ModuleDeployments.TestPriceOracle['80084'].address,
      core.hhUser1,
    );

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetPriceOracle',
        [core.marketIds.weth, testPriceOracle.address],
      ),
    );
  }

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
      console.log(
        '\t Price for weth',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

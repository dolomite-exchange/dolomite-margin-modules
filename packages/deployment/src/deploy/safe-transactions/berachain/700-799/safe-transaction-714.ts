import { LowerPercentage, OptimalUtilizationRate } from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set new risk caps
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  for (const marketId of core.marketIds.stablecoinsWithUnifiedInterestRateModels) {
    transactions.push(await encodeUpdateModularInterestSetterParams(core, marketId, { lowerRate: LowerPercentage._7 }));
  }

  transactions.push(
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.nect, {
      lowerRate: LowerPercentage._12,
      optimalUtilizationRate: OptimalUtilizationRate._80,
    }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.usda, {
      lowerRate: LowerPercentage._12,
      optimalUtilizationRate: OptimalUtilizationRate._80,
    }),
  );

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

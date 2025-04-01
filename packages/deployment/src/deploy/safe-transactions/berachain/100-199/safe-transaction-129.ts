import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkInterestSetter } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Update the interest rate model for stables
 * - Update the supply cap for srUSD and rUSD
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  for (const marketId of core.marketIds.stablecoinsWithUnifiedInterestRateModels) {
    transactions.push(
      await encodeSetInterestSetter(core, marketId, core.interestSetters.linearStepFunction8L92U90OInterestSetter),
    );
  }

  transactions.push(
    await encodeSetSupplyCapWithMagic(core, core.marketIds.srUsd, 15_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.rUsd, 15_000_000),
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
    invariants: async () => {
      await checkInterestSetter(
        core,
        core.marketIds.usdc,
        core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

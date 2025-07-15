import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets risk models for various stables
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const rUsdMarketId = core.marketIds.rUsd;
  const interestSetters = core.interestSetters;

  const transactions: EncodedTransaction[] = [
    await encodeSetInterestSetter(core, marketIds.wbera, interestSetters.linearStepFunction40L85U70OInterestSetter),

    await encodeSetInterestSetter(core, rUsdMarketId, interestSetters.linearStepFunction7L93U90OInterestSetter),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.polRUsd, [
      {
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
        debtMarketIds: [rUsdMarketId],
      },
      {
        marginRatioOverride: TargetCollateralization._109,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: marketIds.stablecoins.filter(m => !BigNumber.from(m).eq(rUsdMarketId)),
      },
    ]),
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
    },
  };
}

doDryRunAndCheckDeployment(main);

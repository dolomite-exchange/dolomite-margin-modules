import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetIsCollateralOnly,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Disable RDNT
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetSupplyCap(core, core.marketIds.radiant, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.radiant, true),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.radiant, {
      upperRate: UpperPercentage._300,
      optimalUtilizationRate: OptimalUtilizationRate._40,
    }),
    await encodeSetMinCollateralization(core, core.marketIds.radiant, TargetCollateralization._133),
    await encodeSetLiquidationPenalty(core, core.marketIds.radiant, TargetLiquidationPenalty._10),
  );

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      // loop through borrow and supply, call expiry and check expiration timestamp
    },
  };
}

doDryRunAndCheckDeployment(main);

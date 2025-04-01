import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetInterestSetter,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsSingleCollateral,
  checkBorrowCap,
  checkInterestSetter,
  checkSupplyCap,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Update the caps for BERA
 * - Update the interest rate model for BERA
 * - Update e-mode for srUSD
 * - Enable e-mode for sUSDa
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, marketIds.wbera, 6_250_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.wbera, 5_000_000),
    await encodeSetInterestSetter(
      core,
      marketIds.wbera,
      core.interestSetters.linearStepFunction50L75U70OInterestSetter,
    ),

    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.srUsd, [
      {
        debtMarketIds: [
          core.marketIds.usdc,
          core.marketIds.honey,
          core.marketIds.usdt,
          core.marketIds.usde,
          core.marketIds.nect,
        ],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
      },
      {
        debtMarketIds: [core.marketIds.rUsd],
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.sUsda, [
      {
        debtMarketIds: [core.marketIds.usda],
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
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
      await checkInterestSetter(core, marketIds.wbera, core.interestSetters.linearStepFunction50L75U70OInterestSetter);
      await checkSupplyCap(core, marketIds.wbera, parseEther(`${6_250_000}`));
      await checkBorrowCap(core, marketIds.wbera, parseEther(`${5_000_000}`));

      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.srUsd, [
        {
          debtMarketIds: [
            core.marketIds.usdc,
            core.marketIds.honey,
            core.marketIds.usdt,
            core.marketIds.usde,
            core.marketIds.nect,
            core.marketIds.rUsd,
          ],
          marginRatioOverride: TargetCollateralization._111,
          liquidationRewardOverride: TargetLiquidationPenalty._4,
        },
        {
          debtMarketIds: [core.marketIds.rUsd],
          marginRatioOverride: TargetCollateralization._105,
          liquidationRewardOverride: TargetLiquidationPenalty._2,
        },
      ]);
      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.sUsda, [
        {
          debtMarketIds: [core.marketIds.usda],
          marginRatioOverride: TargetCollateralization._105,
          liquidationRewardOverride: TargetLiquidationPenalty._2,
        },
      ]);
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategorySettings,
  encodeSetBorrowCapWithMagic,
  encodeSetIsCollateralOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCap,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Risk updates
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetIsCollateralOnly(core, core.marketIds.eBtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.lbtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.solvBtc, true),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.eBtc, 1),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.uniBtc, 5),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.solvBtc, 2.5),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.solvBtc, 2.5),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.nect, 1_000_000),

    await encodeSetBorrowCapWithMagic(core, core.marketIds.nect, 950_000),

    await encodeSetSupplyCap(core, core.marketIds.lbtc, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.sbtc, ONE_BI),

    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.polRUsd, [
      {
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
        debtMarketIds: [core.marketIds.rUsd],
      },
      {
        marginRatioOverride: TargetCollateralization._109,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: core.marketIds.stablecoins.filter((m) => !BigNumber.from(m).eq(core.marketIds.rUsd)),
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.solvBtc, [
      {
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._10,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
        debtMarketIds: [core.marketIds.wbtc],
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.srUsd, [
      {
        debtMarketIds: core.marketIds.stablecoins.filter((m) => !BigNumber.from(m).eq(core.marketIds.rUsd)),
        marginRatioOverride: TargetCollateralization._109,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
      },
      {
        debtMarketIds: [core.marketIds.rUsd],
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.uniBtc, [
      {
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._10,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
        debtMarketIds: [core.marketIds.wbtc],
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.xSolvBtc, [
      {
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._10,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
        debtMarketIds: [core.marketIds.solvBtc, core.marketIds.wbtc],
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

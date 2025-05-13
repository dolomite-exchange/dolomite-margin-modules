import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { parseBtc } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId, encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkAccountRiskOverrideIsSingleCollateral,
  checkBorrowCap,
  checkLiquidationPenalty,
  checkMinCollateralization,
  checkSupplyCap, printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists HENLO, iBERA, and iBGT
 * - Set the risk parameters on uniBTC
 * - Set risk overrides for HENLO, iBERA, and uniBTC
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    ...(await encodeAddMarket(
      core,
      core.tokens.henlo,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${500_000_000}`),
      parseEther(`${250_000_000}`),
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.iBera,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${2_500_000}`),
      parseEther(`${1_250_000}`),
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.iBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      ONE_BI,
      ONE_BI,
      true,
    )),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.uniBtc, 25),
    await encodeSetMinCollateralization(core, core.marketIds.uniBtc, TargetCollateralization._166),
    await encodeSetLiquidationPenalty(core, core.marketIds.uniBtc, TargetLiquidationPenalty._15),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.henlo, [
      {
        marginRatioOverride: TargetCollateralization._166,
        liquidationRewardOverride: TargetLiquidationPenalty._15,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._166,
        liquidationRewardOverride: TargetLiquidationPenalty._15,
        debtMarketIds: [core.marketIds.wbera],
      },
    ]),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.iBera, AccountRiskOverrideCategory.BERA),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.uniBtc, [
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: [core.marketIds.solvBtc],
      },
      {
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._8,
        debtMarketIds: [core.marketIds.nect, core.marketIds.usdc],
      },
    ]),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      await checkSupplyCap(core, core.marketIds.henlo, parseEther(`${500_000_000}`));
      await checkSupplyCap(core, core.marketIds.iBera, parseEther(`${2_500_000}`));
      await checkSupplyCap(core, core.marketIds.iBgt, ONE_BI);
      await checkSupplyCap(core, core.marketIds.uniBtc, parseBtc(`${25}`));

      await checkBorrowCap(core, core.marketIds.henlo, parseEther(`${250_000_000}`));
      await checkBorrowCap(core, core.marketIds.iBera, parseEther(`${1_250_000}`));
      await checkBorrowCap(core, core.marketIds.iBgt, ONE_BI);

      await checkMinCollateralization(core, core.marketIds.henlo, TargetCollateralization._150);
      await checkMinCollateralization(core, core.marketIds.iBera, TargetCollateralization._166);
      await checkMinCollateralization(core, core.marketIds.iBgt, TargetCollateralization._166);
      await checkMinCollateralization(core, core.marketIds.uniBtc, TargetCollateralization._166);

      await checkLiquidationPenalty(core, core.marketIds.henlo, TargetLiquidationPenalty._15);
      await checkLiquidationPenalty(core, core.marketIds.iBera, TargetLiquidationPenalty._15);
      await checkLiquidationPenalty(core, core.marketIds.iBgt, TargetLiquidationPenalty._15);
      await checkLiquidationPenalty(core, core.marketIds.uniBtc, TargetLiquidationPenalty._15);

      await checkAccountRiskOverrideCategory(core, core.marketIds.iBera, AccountRiskOverrideCategory.BERA);

      await checkAccountRiskOverrideIsSingleCollateral(
        core,
        core.marketIds.henlo,
        [
          {
            marginRatioOverride: TargetCollateralization._166,
            liquidationRewardOverride: TargetLiquidationPenalty._15,
            debtMarketIds: core.marketIds.stablecoins,
          },
          {
            marginRatioOverride: TargetCollateralization._166,
            liquidationRewardOverride: TargetLiquidationPenalty._15,
            debtMarketIds: [core.marketIds.wbera],
          },
        ],
      );

      await checkAccountRiskOverrideIsSingleCollateral(
        core,
        core.marketIds.uniBtc,
        [
          {
            marginRatioOverride: TargetCollateralization._111,
            liquidationRewardOverride: TargetLiquidationPenalty._4,
            debtMarketIds: [core.marketIds.solvBtc],
          },
          {
            marginRatioOverride: TargetCollateralization._133,
            liquidationRewardOverride: TargetLiquidationPenalty._8,
            debtMarketIds: [core.marketIds.nect, core.marketIds.usdc],
          },
        ],
      );

      await printPriceForVisualCheck(core, core.tokens.henlo);
      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);

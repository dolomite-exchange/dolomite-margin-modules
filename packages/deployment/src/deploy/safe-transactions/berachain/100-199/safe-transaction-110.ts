import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetBorrowCapWithMagic,
  encodeSetBorrowOnlyByMarketId,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkAccountRiskOverrideIsBorrowOnly,
  checkAccountRiskOverrideIsSingleCollateral,
  checkBorrowCap,
  checkInterestSetter,
  checkIsCollateralOnly,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Modify risk params for rUSD
 * - List srUSD as collateral
 * - Enable e-mode for rUSD and srUSD
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.rUsd)),
    await encodeSetIsCollateralOnly(core, marketIds.rUsd, false),
    await encodeSetSupplyCapWithMagic(core, marketIds.rUsd, 5_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.rUsd, 3_000_000),
    await encodeSetInterestSetter(core, marketIds.rUsd, core.interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetBorrowOnlyByMarketId(core, marketIds.rUsd, true),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.rUsd, AccountRiskOverrideCategory.STABLE),

    ...(await encodeInsertChronicleOracleV3(core, core.tokens.srUsd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.srUsd,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._8,
      parseEther(`${5_000_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.srUsd, [
      {
        debtMarketIds: [core.marketIds.rUsd],
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
      await checkInterestSetter(core, marketIds.rUsd, core.interestSetters.linearStepFunction12L88U90OInterestSetter);
      await checkSupplyCap(core, marketIds.rUsd, parseEther(`${5_000_000}`));
      await checkBorrowCap(core, marketIds.rUsd, parseEther(`${3_000_000}`));
      await checkAccountRiskOverrideCategory(core, marketIds.rUsd, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.rUsd);
      await checkIsCollateralOnly(core, marketIds.rUsd, false);

      await checkSupplyCap(core, marketIds.srUsd, parseEther(`${5_000_000}`));
      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.srUsd, [
        {
          debtMarketIds: [core.marketIds.rUsd],
          marginRatioOverride: TargetCollateralization._105,
          liquidationRewardOverride: TargetLiquidationPenalty._2,
        },
      ]);
      await printPriceForVisualCheck(core, core.tokens.srUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);

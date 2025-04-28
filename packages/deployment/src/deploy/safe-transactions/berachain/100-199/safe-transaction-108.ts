import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetIsBorrowOnly,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
  encodeSetMinCollateralization,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsBorrowOnly,
  checkAccountRiskOverrideIsSingleCollateral, checkBorrowCap, checkInterestSetter, checkSupplyCap,
} from '../../../../utils/invariant-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  CoreProtocolBerachain,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-berachain';
import { parseEther } from 'ethers/lib/utils';
import { parseBtc } from '@dolomite-exchange/modules-base/src/utils/math-utils';

function getBtcLstRiskFeatureEncoding(core: CoreProtocolBerachain) {
  return [
    {
      debtMarketIds: [core.marketIds.nect],
      marginRatioOverride: TargetCollateralization._133,
      liquidationRewardOverride: TargetLiquidationPenalty._8,
    },
    {
      debtMarketIds: [core.marketIds.solvBtc],
      marginRatioOverride: TargetCollateralization._111,
      liquidationRewardOverride: TargetLiquidationPenalty._4,
    },
  ];
}

/**
 * This script encodes the following transactions:
 * - Enable e-mode risk settings for various assets
 * - Update supply / borrow caps for various assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, marketIds.nect, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.nect, 5_000_000),
    await encodeSetMinCollateralization(core, marketIds.nect, TargetCollateralization._120),
    await encodeSetIsCollateralOnly(core, marketIds.nect, false),

    await encodeSetSupplyCapWithMagic(core, marketIds.sUsde, 100_000_000),

    await encodeSetBorrowCapWithMagic(core, marketIds.wbtc, 850),
    await encodeSetInterestSetter(core, marketIds.wbtc, core.interestSetters.linearStepFunction4L96U90OInterestSetter),

    await encodeSetBorrowCapWithMagic(core, marketIds.weth, 60_000),
    await encodeSetInterestSetter(core, marketIds.weth, core.interestSetters.linearStepFunction4L96U90OInterestSetter),

    await encodeSetIsBorrowOnly(core, marketIds.nect, true),
    await encodeSetIsBorrowOnly(core, marketIds.rUsd, true),

    // De-list
    await encodeSetIsBorrowOnly(core, marketIds.ylFbtc, true),
    await encodeSetIsBorrowOnly(core, marketIds.ylPumpBtc, true),
    await encodeSetIsBorrowOnly(core, marketIds.ylStEth, true),
    await encodeSetIsBorrowOnly(core, marketIds.stBtc, true),

    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      marketIds.pumpBtc,
      getBtcLstRiskFeatureEncoding(core),
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      marketIds.solvBtc,
      [getBtcLstRiskFeatureEncoding(core)[0]],
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      marketIds.xSolvBtc,
      getBtcLstRiskFeatureEncoding(core),
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.sUsda, [
      {
        debtMarketIds: [core.marketIds.usda],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, marketIds.uniBtc, getBtcLstRiskFeatureEncoding(core)),
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
      await checkSupplyCap(core, core.marketIds.nect, parseEther(`${10_000_000}`));
      await checkBorrowCap(core, core.marketIds.nect, parseEther(`${5_000_000}`));

      await checkSupplyCap(core, core.marketIds.sUsde, parseEther(`${100_000_000}`));
      await checkBorrowCap(core, core.marketIds.wbtc, parseBtc(`${850}`));
      await checkBorrowCap(core, core.marketIds.weth, parseEther(`${60_000}`));

      await checkInterestSetter(core, marketIds.wbtc, core.interestSetters.linearStepFunction4L96U90OInterestSetter);
      await checkInterestSetter(core, marketIds.weth, core.interestSetters.linearStepFunction4L96U90OInterestSetter);

      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.nect);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.rUsd);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.ylFbtc);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.ylPumpBtc);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.ylStEth);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.stBtc);

      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.pumpBtc, getBtcLstRiskFeatureEncoding(core));
      await checkAccountRiskOverrideIsSingleCollateral(
        core,
        marketIds.solvBtc,
        [getBtcLstRiskFeatureEncoding(core)[0]],
      );
      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.xSolvBtc, getBtcLstRiskFeatureEncoding(core));
      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.sUsda, [
        {
          debtMarketIds: [core.marketIds.usda],
          marginRatioOverride: TargetCollateralization._111,
          liquidationRewardOverride: TargetLiquidationPenalty._4,
        },
      ]);
      await checkAccountRiskOverrideIsSingleCollateral(core, marketIds.uniBtc, getBtcLstRiskFeatureEncoding(core));
    },
  };
}

doDryRunAndCheckDeployment(main);

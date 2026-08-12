import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  encodeRemoveAllRiskFeaturesByMarketId,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adjust risk feature
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  await encodeReportCard(
    core,
    [
      core.chainlinkPriceOracleV3,
      core.redstonePriceOracleV3,
      core.chroniclePriceOracleV3,
      core.constantPriceOracle,
      core.erc4626Oracle,
      core.twapPriceOracleV3,
    ],
  );

  const transactions: EncodedTransaction[] = [
    await encodeRemoveAllRiskFeaturesByMarketId(core, core.marketIds.wstEth),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorProxyV6: core.liquidatorProxyV6 },
      'liquidatorProxyV6',
      'ownerSetMarketToPartialLiquidationSupported',
      [[core.marketIds.btcCx], [true]],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorProxyV6: core.liquidatorProxyV6 },
      'liquidatorProxyV6',
      'ownerSetMarketToPartialLiquidationSupported',
      [[core.marketIds.wlfiCx], [true]],
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.btcCx, [
      {
        marginRatioOverride: TargetCollateralization._125,
        liquidationRewardOverride: TargetLiquidationPenalty._7,
        debtMarketIds: [core.marketIds.usdc, core.marketIds.usd1],
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.wlfiCx, [
      {
        marginRatioOverride: TargetCollateralization._166,
        liquidationRewardOverride: TargetLiquidationPenalty._15,
        debtMarketIds: [core.marketIds.usdc, core.marketIds.usd1],
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

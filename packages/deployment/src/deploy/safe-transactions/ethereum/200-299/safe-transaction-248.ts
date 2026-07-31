import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps
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
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.btcCx, undefined, undefined, undefined, {
      ignoreDescription: true,
    })),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.wlfiCx, undefined, undefined, undefined, {
      ignoreDescription: true,
    })),
    ...(await encodeAddMarket(
      core,
      core.marketIds.btcCx,
      core.tokens.btcCx,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      ONE_BI, // Set supply cap to 0 for now
      0,
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.marketIds.wlfiCx,
      core.tokens.wlfiCx,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${2_000_000_000}`),
      0,
      true,
      undefined,
      { skipAmountValidation: true },
    )),
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
      await printPriceForVisualCheck(core, core.tokens.btcCx);
      await printPriceForVisualCheck(core, core.tokens.wlfiCx);
    },
  };
}

doDryRunAndCheckDeployment(main);

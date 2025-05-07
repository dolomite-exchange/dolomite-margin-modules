import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { CoreProtocolBerachain } from '../../../../../../base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSingleCollateralWithStrictDebtByMarketId, encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

function getBtcLstRiskFeatureEncoding(core: CoreProtocolBerachain) {
  const marketIds = core.marketIds;
  return [
    {
      debtMarketIds: [marketIds.honey, marketIds.nect, marketIds.usdc, marketIds.usdt],
      marginRatioOverride: TargetCollateralization._142,
      liquidationRewardOverride: TargetLiquidationPenalty._10,
    },
    {
      debtMarketIds: [marketIds.solvBtc],
      marginRatioOverride: TargetCollateralization._111,
      liquidationRewardOverride: TargetLiquidationPenalty._4,
    },
  ];
}

/**
 * This script encodes the following transactions:
 * - Update risk parameters for a few assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.solvBtc, 200),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.xSolvBtc, 200),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.solvBtc, 150),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.rUsd, 48_000_000),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.xSolvBtc,
      getBtcLstRiskFeatureEncoding(core),
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.solvBtc,
      [getBtcLstRiskFeatureEncoding(core)[0]],
    ),
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

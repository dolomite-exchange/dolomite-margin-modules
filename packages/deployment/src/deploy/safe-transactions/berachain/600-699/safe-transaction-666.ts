import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists wgBera
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChronicleOracleV3(
      core,
      core.tokens.wgBera,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.wgBera,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      /* maxSupplyWei */ parseEther(`${250_000}`),
      /* maxBorrowWei */ 0,
      /* isCollateralOnly */ true,
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.wgBera,
      [
        {
          marginRatioOverride: TargetCollateralization._133,
          liquidationRewardOverride: TargetLiquidationPenalty._15,
          debtMarketIds: [core.marketIds.wbera],
        },
      ],
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
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.wgBera);
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { CHRONICLE_PRICE_SCRIBES_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Modify caps for wBERA
 * - Lists savUSD
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetBorrowCapWithMagic(core, core.marketIds.wbera, 2_100_000),
    ...await encodeInsertChronicleOracleV3(
      core,
      core.tokens.savUsd,
      false,
      null,
      CHRONICLE_PRICE_SCRIBES_MAP[core.network][core.tokens.usdc.address]!.scribeAddress,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.savUsd,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${10_000_000}`),
      ZERO_BI,
      true,
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.savUsd,
      [
        {
          debtMarketIds: core.marketIds.stablecoins,
          marginRatioOverride: TargetCollateralization._111,
          liquidationRewardOverride: TargetLiquidationPenalty._4,
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
      await printPriceForVisualCheck(core, core.tokens.savUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);

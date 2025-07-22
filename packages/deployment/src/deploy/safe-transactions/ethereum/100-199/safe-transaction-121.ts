import {
  AccountRiskOverrideCategory,
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideCategory, checkMarket } from '../../../../utils/invariant-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { encodeModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Sets up e-mode for initial markets
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;

  const transactions: EncodedTransaction[] = [
    await encodeModularInterestSetterParams(
      core,
      core.tokens.rUsd,
      LowerPercentage._11,
      UpperPercentage._70,
      OptimalUtilizationRate._90,
    ),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.rUsd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.rUsd,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8_5,
      parseEther(`${75_000_000}`),
      parseEther(`${60_000_000}`),
      false,
    )),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.rUsd, AccountRiskOverrideCategory.STABLE),
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
      await checkMarket(core, core.marketIds.rUsd, core.tokens.rUsd);

      await checkAccountRiskOverrideCategory(core, marketIds.rUsd, AccountRiskOverrideCategory.STABLE);
    },
  };
}

doDryRunAndCheckDeployment(main);

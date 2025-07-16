import {
  AccountRiskOverrideCategory,
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideCategory, checkMarket } from '../../../../utils/invariant-utils';
import {
  encodeInsertChainlinkOracleV3,
  encodeInsertChronicleOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
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
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.mEth)),
    ...(await encodeAddMarket(
      core,
      core.tokens.mEth,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${2_500}`),
      ZERO_BI,
      true,
    )),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.mEth, AccountRiskOverrideCategory.ETH),
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
      await checkMarket(core, core.marketIds.mEth, core.tokens.mEth);

      await checkAccountRiskOverrideCategory(core, marketIds.mEth, AccountRiskOverrideCategory.ETH);
    },
  };
}

doDryRunAndCheckDeployment(main);

import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetAccountRiskOverrideCategorySettings,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkAccountRiskOverrideCategorySettings, checkMarket,
} from '../../../../utils/invariant-utils';
import {
  encodeInsertChainlinkOracleV3,
  encodeInsertChronicleOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';

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
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.srUsd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.srUsd,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8_5,
      parseEther(`${100_000_000}`),
      ZERO_BI,
      true,
    )),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.srUsd, AccountRiskOverrideCategory.STABLE),
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
      await checkMarket(core, core.marketIds.srUsd, core.tokens.srUsd);

      await checkAccountRiskOverrideCategory(core, marketIds.srUsd, AccountRiskOverrideCategory.STABLE);
    },
  };
}

doDryRunAndCheckDeployment(main);

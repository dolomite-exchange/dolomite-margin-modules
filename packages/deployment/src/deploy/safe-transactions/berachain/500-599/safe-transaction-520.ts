import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertRedstoneOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - List the BYUSD market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.byusd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.byusd,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction7L93U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${40_000_000}`),
      parseUsdc(`${35_000_000}`),
      false,
    )),
    await encodeSetAccountRiskOverrideCategoryByMarketId(
      core,
      core.marketIds.byusd,
      AccountRiskOverrideCategory.STABLE,
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

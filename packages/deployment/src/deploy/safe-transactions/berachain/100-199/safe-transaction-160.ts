import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { AccountRiskOverrideCategory } from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkInterestSetter,
  checkIsCollateralOnly,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Sets USDa to be in the stablecoin category
 * - Make HENLO a borrowable asset
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.usda, AccountRiskOverrideCategory.STABLE),
    await encodeSetIsCollateralOnly(core, core.marketIds.henlo, false),
    await encodeSetInterestSetter(
      core,
      core.marketIds.henlo,
      core.interestSetters.linearStepFunction50L75U70OInterestSetter,
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
      await checkAccountRiskOverrideCategory(core, core.marketIds.usda, AccountRiskOverrideCategory.STABLE);
      await checkIsCollateralOnly(core, core.marketIds.henlo, false);
      await checkInterestSetter(
        core,
        core.marketIds.henlo,
        core.interestSetters.linearStepFunction50L75U70OInterestSetter,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

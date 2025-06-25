import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
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
  checkAccountRiskOverrideCategorySettings,
} from '../../../../utils/invariant-utils';

enum InterestSetter {
  AlwaysZero,
  Modular,
}

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
    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.ETH,
      TargetCollateralization._111,
      TargetLiquidationPenalty._4,
    ),
    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.STABLE,
      TargetCollateralization._111,
      TargetLiquidationPenalty._4,
    ),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.weth, AccountRiskOverrideCategory.ETH),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.weEth, AccountRiskOverrideCategory.ETH),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.sUsde, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usd1, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usdc, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usdt, AccountRiskOverrideCategory.STABLE),
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
      await checkAccountRiskOverrideCategorySettings(
        core,
        AccountRiskOverrideCategory.ETH,
        TargetCollateralization._111,
        TargetLiquidationPenalty._4,
      );
      await checkAccountRiskOverrideCategorySettings(
        core,
        AccountRiskOverrideCategory.STABLE,
        TargetCollateralization._111,
        TargetLiquidationPenalty._4,
      );

      await checkAccountRiskOverrideCategory(core, marketIds.weth, AccountRiskOverrideCategory.ETH);
      await checkAccountRiskOverrideCategory(core, marketIds.weEth, AccountRiskOverrideCategory.ETH);

      await checkAccountRiskOverrideCategory(core, marketIds.sUsde, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usd1, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usdc, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usdt, AccountRiskOverrideCategory.STABLE);
    },
  };
}

doDryRunAndCheckDeployment(main);

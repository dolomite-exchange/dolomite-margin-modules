import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
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
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

/**
 * This script encodes the following transactions:
 * - Enable e-mode categories and settings for various assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const transactions: EncodedTransaction[] = [
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.wbera, AccountRiskOverrideCategory.BERA),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.eBtc, AccountRiskOverrideCategory.BTC),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.lbtc, AccountRiskOverrideCategory.BTC),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.wbtc, AccountRiskOverrideCategory.BTC),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.beraEth, AccountRiskOverrideCategory.ETH),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.stone, AccountRiskOverrideCategory.ETH),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.weth, AccountRiskOverrideCategory.ETH),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.weEth, AccountRiskOverrideCategory.ETH),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.honey, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.nect, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.sUsde, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usdc, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usde, AccountRiskOverrideCategory.STABLE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, marketIds.usdt, AccountRiskOverrideCategory.STABLE),

    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.BERA,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
    ),
    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.BTC,
      TargetCollateralization._111,
      TargetLiquidationPenalty._4,
    ),
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
      await checkAccountRiskOverrideCategory(core, marketIds.wbera, AccountRiskOverrideCategory.BERA);
      await checkAccountRiskOverrideCategory(core, marketIds.eBtc, AccountRiskOverrideCategory.BTC);
      await checkAccountRiskOverrideCategory(core, marketIds.lbtc, AccountRiskOverrideCategory.BTC);
      await checkAccountRiskOverrideCategory(core, marketIds.wbtc, AccountRiskOverrideCategory.BTC);
      await checkAccountRiskOverrideCategory(core, marketIds.beraEth, AccountRiskOverrideCategory.ETH);
      await checkAccountRiskOverrideCategory(core, marketIds.stone, AccountRiskOverrideCategory.ETH);
      await checkAccountRiskOverrideCategory(core, marketIds.weth, AccountRiskOverrideCategory.ETH);
      await checkAccountRiskOverrideCategory(core, marketIds.weEth, AccountRiskOverrideCategory.ETH);
      await checkAccountRiskOverrideCategory(core, marketIds.honey, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.nect, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.sUsde, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usdc, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usde, AccountRiskOverrideCategory.STABLE);
      await checkAccountRiskOverrideCategory(core, marketIds.usdt, AccountRiskOverrideCategory.STABLE);

      await checkAccountRiskOverrideCategorySettings(
        core,
        AccountRiskOverrideCategory.BERA,
        TargetCollateralization._120,
        TargetLiquidationPenalty._7,
      );
      await checkAccountRiskOverrideCategorySettings(
        core,
        AccountRiskOverrideCategory.BTC,
        TargetCollateralization._111,
        TargetLiquidationPenalty._4,
      );
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
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  AccountRiskOverrideCategory,
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { parseBtc } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetAccountRiskOverrideCategorySettings,
  encodeSetBorrowCapWithMagic,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkInterestSetter,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists the cbBTC asset
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.wbtc, 100),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.wbtc, 80),
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.cbBtc,
      LowerPercentage._4,
      UpperPercentage._60,
      OptimalUtilizationRate._80,
    ),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.cbBtc)),
    ...(await encodeAddMarket(
      core,
      core.tokens.cbBtc,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization._128,
      TargetLiquidationPenalty._7_5,
      parseBtc(`${10_000}`),
      parseBtc(`${1_000}`),
      false,
    )),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.cbBtc, AccountRiskOverrideCategory.BTC),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.wbtc, AccountRiskOverrideCategory.BTC),
    await encodeSetAccountRiskOverrideCategorySettings(
      core,
      AccountRiskOverrideCategory.BTC,
      TargetCollateralization._117,
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
      await printPriceForVisualCheck(core, core.tokens.cbBtc);
      await checkMarket(core, core.marketIds.cbBtc, core.tokens.cbBtc);
      await checkInterestSetter(core, core.marketIds.cbBtc, core.interestSetters.modularInterestSetter);
      await checkSupplyCap(core, core.marketIds.cbBtc, parseBtc(`${10_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

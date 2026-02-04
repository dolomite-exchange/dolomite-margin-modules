import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  StEthExchangeRatePriceOracle__factory,
} from 'packages/oracles/src/types/factories/contracts/StEthExchangeRatePriceOracle__factory';
import { ST_ETH_MAP } from '../../../../../../base/src/utils/constants';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
  encodeSetBorrowCapWithMagic,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3, encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkInterestSetter,
  checkIsCollateralOnly,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const stEthExchangeRatePriceOracleAddress = await deployContractAndSave('StEthExchangeRatePriceOracle', [
    ST_ETH_MAP[Network.Ethereum].address,
    core.tokens.wstEth.address,
    core.dolomiteMargin.address,
  ]);
  const stEthExchangeRatePriceOracle = StEthExchangeRatePriceOracle__factory.connect(
    stEthExchangeRatePriceOracleAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.wsrUsd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.wsrUsd,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${25_000_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.srUsd, 1),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.wsrUsd, [
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
        debtMarketIds: [core.marketIds.rUsd],
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.srUsd, [
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: core.marketIds.stablecoins,
      },
      {
        marginRatioOverride: TargetCollateralization._105,
        liquidationRewardOverride: TargetLiquidationPenalty._2,
        debtMarketIds: [core.marketIds.rUsd],
      },
    ]),

    ...(await encodeInsertOracle(core, core.tokens.wstEth, stEthExchangeRatePriceOracle, core.tokens.weth)),
    ...(await encodeAddMarket(
      core,
      core.tokens.wstEth,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._121,
      TargetLiquidationPenalty._6,
      parseEther(`${500_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetMinCollateralization(core, core.marketIds.weEth, TargetCollateralization._121),
    await encodeSetLiquidationPenalty(core, core.marketIds.weEth, TargetLiquidationPenalty._6),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.wstEth, AccountRiskOverrideCategory.ETH),

    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.sUsde, [
      {
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._4,
        debtMarketIds: core.marketIds.stablecoins,
      },
    ]),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.rUsd, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.rUsd, 10_000_000),

    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.rUsd, AccountRiskOverrideCategory.NONE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.wsrUsd, AccountRiskOverrideCategory.NONE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.srUsd, AccountRiskOverrideCategory.NONE),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.sUsde, AccountRiskOverrideCategory.NONE),
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
      assertHardhatInvariant(
        (await stEthExchangeRatePriceOracle.LIDO()) === ST_ETH_MAP[Network.Ethereum].address,
        'Invalid LIDO address',
      );
      assertHardhatInvariant(
        (await stEthExchangeRatePriceOracle.WST_ETH()) === core.tokens.wstEth.address,
        'Invalid WST_ETH address',
      );
      assertHardhatInvariant(
        (await stEthExchangeRatePriceOracle.DOLOMITE_MARGIN()) === core.dolomiteMargin.address,
        'Invalid DOLOMITE_MARGIN address',
      );

      await checkIsCollateralOnly(core, core.marketIds.srUsd, true);
      await checkSupplyCap(core, core.marketIds.srUsd, parseEther('1'));

      await printPriceForVisualCheck(core, core.tokens.wsrUsd);
      await checkMarket(core, core.marketIds.wsrUsd, core.tokens.wsrUsd);
      await checkInterestSetter(core, core.marketIds.wsrUsd, core.interestSetters.alwaysZeroInterestSetter);
      await checkSupplyCap(core, core.marketIds.wsrUsd, parseEther(`${25_000_000}`));
      await checkIsCollateralOnly(core, core.marketIds.wsrUsd, true);

      await printPriceForVisualCheck(core, core.tokens.wstEth);
      await checkMarket(core, core.marketIds.wstEth, core.tokens.wstEth);
      await checkInterestSetter(core, core.marketIds.wstEth, core.interestSetters.alwaysZeroInterestSetter);
      await checkSupplyCap(core, core.marketIds.wstEth, parseEther(`${500_000}`));
      await checkIsCollateralOnly(core, core.marketIds.wstEth, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

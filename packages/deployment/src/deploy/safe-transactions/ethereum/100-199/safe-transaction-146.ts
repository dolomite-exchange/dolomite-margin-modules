import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { ERC4626PriceOracle__factory } from 'packages/oracles/src/types';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetIsBorrowOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import {
  encodeInsertERC4626Oracle,
  encodeInsertRedstoneOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkInterestSetter,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists the cUSD and stcUSD markets
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const fundamentalFeedAddress = await deployContractAndSave(
    'ERC4626PriceOracle',
    [[core.tokens.stcUsd.address], core.dolomiteMargin.address],
  );
  (core as any).erc4626Oracle = ERC4626PriceOracle__factory.connect(fundamentalFeedAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertRedstoneOracleV3(core, core.tokens.cUsd),
    ...await encodeInsertERC4626Oracle(core, core.tokens.stcUsd, core.tokens.cUsd.address),
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.cUsd,
      LowerPercentage._8,
      UpperPercentage._50,
      OptimalUtilizationRate._90,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.cUsd,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._8,
      parseEther(`${10_000_000}`),
      ZERO_BI,
      false,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.stcUsd,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${10_000_000}`),
      ZERO_BI,
      true,
    ),
    await encodeSetIsBorrowOnly(core, core.marketIds.cUsd, true),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.stcUsd,
      [
        {
          liquidationRewardOverride: TargetLiquidationPenalty._4,
          debtMarketIds: core.marketIds.stablecoins,
          marginRatioOverride: TargetCollateralization._111,
        },
        {
          liquidationRewardOverride: TargetLiquidationPenalty._3,
          debtMarketIds: [core.marketIds.cUsd],
          marginRatioOverride: TargetCollateralization._109,
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
      await printPriceForVisualCheck(core, core.tokens.cUsd);
      await checkMarket(core, core.marketIds.cUsd, core.tokens.cUsd);
      await checkInterestSetter(core, core.marketIds.cUsd, core.interestSetters.modularInterestSetter);
      await checkSupplyCap(core, core.marketIds.cUsd, parseEther(`${10_000_000}`));

      await printPriceForVisualCheck(core, core.tokens.stcUsd);
      await checkMarket(core, core.marketIds.stcUsd, core.tokens.stcUsd);
      await checkInterestSetter(core, core.marketIds.stcUsd, core.interestSetters.alwaysZeroInterestSetter);
      await checkSupplyCap(core, core.marketIds.stcUsd, parseEther(`${10_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

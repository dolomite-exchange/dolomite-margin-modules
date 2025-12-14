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
  encodeInsertChainlinkOracleV3,
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
 * - Lists the solvBTC asset
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChainlinkOracleV3(core, core.tokens.solvBtc),
    ...await encodeAddMarket(
      core,
      core.tokens.solvBtc,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._10,
      parseEther(`${75}`),
      ZERO_BI,
      true,
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.solvBtc,
      [
        {
          liquidationRewardOverride: TargetLiquidationPenalty._15,
          debtMarketIds: core.marketIds.stablecoins,
          marginRatioOverride: TargetCollateralization._142,
        },
        // TODO: add WBTC market?
        // {
        //   liquidationRewardOverride: TargetLiquidationPenalty._10,
        //   debtMarketIds: [core.marketIds.wbtc],
        //   marginRatioOverride: TargetCollateralization._125,
        // },
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
      await printPriceForVisualCheck(core, core.tokens.solvBtc);
      await checkMarket(core, core.marketIds.solvBtc, core.tokens.solvBtc);
      await checkInterestSetter(core, core.marketIds.solvBtc, core.interestSetters.alwaysZeroInterestSetter);
      await checkSupplyCap(core, core.marketIds.solvBtc, parseEther(`${75}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

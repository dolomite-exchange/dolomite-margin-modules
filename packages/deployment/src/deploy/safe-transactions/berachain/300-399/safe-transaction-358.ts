import { parseEther } from 'ethers/lib/utils';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracle__factory } from 'packages/oracles/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsCollateralOnly, checkSupplyCap, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the DOLO oracle on Berachain
 * - Adds the DOLO market
 * - Opens up borrowing SolvBTC and xSolvBTC
 * - Removes SolvBTC as borrowable from other BTC LSTs
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const twapAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(
      core,
      core.tokenomics.dolo,
      IAlgebraV3Pool__factory.connect('0xD5980e98A89e2D2361b3BE657e8a003c6d3514e3', core.hhUser1),
    ),
    'DOLOPriceOracle',
  );
  const twap = PancakeV3PriceOracle__factory.connect(twapAddress, core.hhUser1);

  const borrowableStables = [
    core.marketIds.honey,
    core.marketIds.nect,
    core.marketIds.usde,
    core.marketIds.usdc,
    core.marketIds.usdt,
  ];
  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapOracle(core, core.tokenomics.dolo, twap, core.tokens.wbera)),
    ...(await encodeAddMarket(
      core,
      core.tokens.dolo,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${5_000_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.solvBtc, [
      {
        debtMarketIds: [core.marketIds.wbtc],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
      },
      {
        debtMarketIds: borrowableStables,
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._9,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.xSolvBtc, [
      {
        debtMarketIds: [core.marketIds.solvBtc, core.marketIds.wbtc],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
      },
      {
        debtMarketIds: borrowableStables,
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._9,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.pumpBtc, [
      {
        debtMarketIds: [core.marketIds.wbtc],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
      },
      {
        debtMarketIds: borrowableStables,
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._9,
      },
    ]),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(core, core.marketIds.uniBtc, [
      {
        debtMarketIds: [core.marketIds.wbtc],
        marginRatioOverride: TargetCollateralization._111,
        liquidationRewardOverride: TargetLiquidationPenalty._5,
      },
      {
        debtMarketIds: borrowableStables,
        marginRatioOverride: TargetCollateralization._133,
        liquidationRewardOverride: TargetLiquidationPenalty._9,
      },
    ]),
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
      await checkIsCollateralOnly(core, core.marketIds.dolo, true);
      await checkSupplyCap(core, core.marketIds.dolo, parseEther(`${5_000_000}`));
      await printPriceForVisualCheck(core, core.tokenomics.dolo);
    },
  };
}

doDryRunAndCheckDeployment(main);

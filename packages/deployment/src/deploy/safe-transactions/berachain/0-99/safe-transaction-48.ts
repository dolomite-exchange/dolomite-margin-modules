import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetBorrowCapWithMagic,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSupplyCapWithMagic, encodeSetIsCollateralOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printRiskDataVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Sets initial LTV and liquidation penalties for each market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const interestSetters = core.interestSetters;

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    // LTVs
    await encodeSetMinCollateralization(core, marketIds.honey, TargetCollateralization._120),
    await encodeSetMinCollateralization(core, marketIds.usdc, TargetCollateralization._120),
    await encodeSetMinCollateralization(core, marketIds.usdt, TargetCollateralization._125),
    await encodeSetMinCollateralization(core, marketIds.usde, TargetCollateralization._125),
    await encodeSetMinCollateralization(core, marketIds.sUsde, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, marketIds.weth, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, marketIds.wbtc, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, marketIds.solvBtc, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.xSolvBtc, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.pumpBtc, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.eBtc, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.stone, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.weEth, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.ylPumpBtc, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.usda, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.sUsda, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.rswEth, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.rsEth, TargetCollateralization._200),
    await encodeSetMinCollateralization(core, marketIds.lbtc, TargetCollateralization._150),
    await encodeSetMinCollateralization(core, marketIds.rUsd, TargetCollateralization._125),
    // Liquidation Penalties
    await encodeSetLiquidationPenalty(core, marketIds.honey, TargetLiquidationPenalty._6),
    await encodeSetLiquidationPenalty(core, marketIds.usdc, TargetLiquidationPenalty._6),
    await encodeSetLiquidationPenalty(core, marketIds.usdt, TargetLiquidationPenalty._8),
    await encodeSetLiquidationPenalty(core, marketIds.usde, TargetLiquidationPenalty._8),
    await encodeSetLiquidationPenalty(core, marketIds.sUsde, TargetLiquidationPenalty._8),
    await encodeSetLiquidationPenalty(core, marketIds.weth, TargetLiquidationPenalty._7),
    await encodeSetLiquidationPenalty(core, marketIds.wbtc, TargetLiquidationPenalty._7),
    await encodeSetLiquidationPenalty(core, marketIds.solvBtc, TargetLiquidationPenalty._15),
    await encodeSetLiquidationPenalty(core, marketIds.xSolvBtc, TargetLiquidationPenalty._15),
    await encodeSetLiquidationPenalty(core, marketIds.pumpBtc, TargetLiquidationPenalty._15),
    await encodeSetLiquidationPenalty(core, marketIds.eBtc, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.stone, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.weEth, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.ylPumpBtc, TargetLiquidationPenalty._15),
    await encodeSetLiquidationPenalty(core, marketIds.usda, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.sUsda, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.rswEth, TargetLiquidationPenalty._10),
    await encodeSetLiquidationPenalty(core, marketIds.rsEth, TargetLiquidationPenalty._10),
    await encodeSetLiquidationPenalty(core, marketIds.lbtc, TargetLiquidationPenalty._9),
    await encodeSetLiquidationPenalty(core, marketIds.rUsd, TargetLiquidationPenalty._8),
    // Supply Caps
    await encodeSetSupplyCapWithMagic(core, marketIds.honey, 100_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.usdc, 50_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.usdt, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.usde, 50_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.sUsde, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.weth, 75_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.wbtc, 1_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.solvBtc, 5),
    await encodeSetSupplyCapWithMagic(core, marketIds.xSolvBtc, 5),
    await encodeSetSupplyCapWithMagic(core, marketIds.pumpBtc, 7),
    await encodeSetSupplyCapWithMagic(core, marketIds.eBtc, 2_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.stone, 10_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.weEth, 25_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.ylPumpBtc, 1),
    await encodeSetSupplyCapWithMagic(core, marketIds.usda, 1_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.sUsda, 10_000_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.rswEth, 10),
    await encodeSetSupplyCapWithMagic(core, marketIds.rsEth, 1),
    await encodeSetSupplyCapWithMagic(core, marketIds.lbtc, 750),
    await encodeSetSupplyCapWithMagic(core, marketIds.rUsd, 10_000_000),
    // Borrow Caps
    await encodeSetBorrowCapWithMagic(core, marketIds.honey, 5_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.usdc, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.usdt, 1_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.usde, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.weth, 25_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.wbtc, 300),
    await encodeSetBorrowCapWithMagic(core, marketIds.solvBtc, 1),
    await encodeSetBorrowCapWithMagic(core, marketIds.eBtc, 250),
    await encodeSetBorrowCapWithMagic(core, marketIds.weEth, 3_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.usda, 800_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.lbtc, 100),
    await encodeSetBorrowCapWithMagic(core, marketIds.rUsd, 5_000_000),
    // Interest Setter
    await encodeSetInterestSetter(core, marketIds.honey, interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.usdc, interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.usdt, interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.usde, interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.weth, interestSetters.linearStepFunction6L94U80OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.wbtc, interestSetters.linearStepFunction6L94U80OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.solvBtc, interestSetters.linearStepFunction6L94U70OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.eBtc, interestSetters.linearStepFunction6L94U70OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.weEth, interestSetters.linearStepFunction6L94U70OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.usda, interestSetters.linearStepFunction12L88U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.lbtc, interestSetters.linearStepFunction6L94U70OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.rUsd, interestSetters.linearStepFunction12L88U90OInterestSetter),
    // Is borrowable?
    await encodeSetIsCollateralOnly(core, marketIds.honey, false),
    await encodeSetIsCollateralOnly(core, marketIds.usdc, false),
    await encodeSetIsCollateralOnly(core, marketIds.usdt, false),
    await encodeSetIsCollateralOnly(core, marketIds.usde, false),
    await encodeSetIsCollateralOnly(core, marketIds.weth, false),
    await encodeSetIsCollateralOnly(core, marketIds.wbtc, false),
    await encodeSetIsCollateralOnly(core, marketIds.solvBtc, false),
    await encodeSetIsCollateralOnly(core, marketIds.eBtc, false),
    await encodeSetIsCollateralOnly(core, marketIds.weEth, false),
    await encodeSetIsCollateralOnly(core, marketIds.usda, false),
    await encodeSetIsCollateralOnly(core, marketIds.lbtc, false),
    await encodeSetIsCollateralOnly(core, marketIds.rUsd, false),
  );
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
      await printRiskDataVisualCheck(core, marketIds.honey);
      await printRiskDataVisualCheck(core, marketIds.usdc);
      await printRiskDataVisualCheck(core, marketIds.usdt);
      await printRiskDataVisualCheck(core, marketIds.usde);
      await printRiskDataVisualCheck(core, marketIds.sUsde);
      await printRiskDataVisualCheck(core, marketIds.weth);
      await printRiskDataVisualCheck(core, marketIds.wbtc);
      await printRiskDataVisualCheck(core, marketIds.solvBtc);
      await printRiskDataVisualCheck(core, marketIds.xSolvBtc);
      await printRiskDataVisualCheck(core, marketIds.pumpBtc);
      await printRiskDataVisualCheck(core, marketIds.eBtc);
      await printRiskDataVisualCheck(core, marketIds.stone);
      await printRiskDataVisualCheck(core, marketIds.weEth);
      await printRiskDataVisualCheck(core, marketIds.ylPumpBtc);
      await printRiskDataVisualCheck(core, marketIds.usda);
      await printRiskDataVisualCheck(core, marketIds.sUsda);
      await printRiskDataVisualCheck(core, marketIds.rswEth);
      await printRiskDataVisualCheck(core, marketIds.rsEth);
      await printRiskDataVisualCheck(core, marketIds.lbtc);
      await printRiskDataVisualCheck(core, marketIds.rUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);

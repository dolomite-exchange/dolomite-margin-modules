import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { parseBtc, parseUsdc, parseUsdt } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkBorrowCap,
  checkLiquidationPenalty,
  checkMinCollateralization,
  checkSupplyCap,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increase the supply cap for various assets
 * - Increase the borrow cap for various assets
 * - Increase the LTV for various assets
 * - Modify the liquidation penalty for various assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    // Supply caps
    await encodeSetSupplyCapWithMagic(core, core.marketIds.honey, 100_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdc, 100_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdt, 25_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usde, 50_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.sUsde, 50_000_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.weth, 90_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.wbtc, 1_250),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.stone, 25_000),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.lbtc, 1_300),
    // Borrow Caps
    await encodeSetBorrowCapWithMagic(core, core.marketIds.honey, 50_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 50_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdt, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usde, 25_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.weth, 30_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.wbtc, 360),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.weEth, 5_000),
    // LTVs
    await encodeSetMinCollateralization(core, core.marketIds.honey, TargetCollateralization.Base),
    await encodeSetMinCollateralization(core, core.marketIds.usdc, TargetCollateralization.Base),
    await encodeSetMinCollateralization(core, core.marketIds.usdt, TargetCollateralization._120),
    await encodeSetMinCollateralization(core, core.marketIds.usde, TargetCollateralization._120),
    await encodeSetMinCollateralization(core, core.marketIds.sUsde, TargetCollateralization._120),
    await encodeSetMinCollateralization(core, core.marketIds.eBtc, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, core.marketIds.weEth, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, core.marketIds.stone, TargetCollateralization._133),
    await encodeSetMinCollateralization(core, core.marketIds.lbtc, TargetCollateralization._133),
    // Liquidation Penalties
    await encodeSetLiquidationPenalty(core, core.marketIds.honey, TargetLiquidationPenalty._6),
    await encodeSetLiquidationPenalty(core, core.marketIds.usdc, TargetLiquidationPenalty._6),
    await encodeSetLiquidationPenalty(core, core.marketIds.usdt, TargetLiquidationPenalty._7),
    await encodeSetLiquidationPenalty(core, core.marketIds.usde, TargetLiquidationPenalty._7),
    await encodeSetLiquidationPenalty(core, core.marketIds.sUsde, TargetLiquidationPenalty._7),
    await encodeSetLiquidationPenalty(core, core.marketIds.eBtc, TargetLiquidationPenalty._8_5),
    await encodeSetLiquidationPenalty(core, core.marketIds.weEth, TargetLiquidationPenalty._8_5),
    await encodeSetLiquidationPenalty(core, core.marketIds.stone, TargetLiquidationPenalty._8_5),
    await encodeSetLiquidationPenalty(core, core.marketIds.lbtc, TargetLiquidationPenalty._8_5),
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
      // Supply caps
      await checkSupplyCap(core, core.marketIds.honey, parseEther(`${100_000_000}`));
      await checkSupplyCap(core, core.marketIds.usdc, parseUsdc(`${100_000_000}`));
      await checkSupplyCap(core, core.marketIds.usdt, parseUsdt(`${25_000_000}`));
      await checkSupplyCap(core, core.marketIds.usde, parseEther(`${50_000_000}`));
      await checkSupplyCap(core, core.marketIds.sUsde, parseEther(`${50_000_000}`));
      await checkSupplyCap(core, core.marketIds.weth, parseEther(`${90_000}`));
      await checkSupplyCap(core, core.marketIds.wbtc, parseBtc(`${1_250}`));
      await checkSupplyCap(core, core.marketIds.stone, parseEther(`${25_000}`));
      await checkSupplyCap(core, core.marketIds.lbtc, parseBtc(`${1_300}`));

      // Borrow caps
      await checkBorrowCap(core, core.marketIds.honey, parseEther(`${50_000_000}`));
      await checkBorrowCap(core, core.marketIds.usdc, parseUsdc(`${50_000_000}`));
      await checkBorrowCap(core, core.marketIds.usdt, parseUsdt(`${10_000_000}`));
      await checkBorrowCap(core, core.marketIds.usde, parseEther(`${25_000_000}`));
      await checkBorrowCap(core, core.marketIds.weth, parseEther(`${30_000}`));
      await checkBorrowCap(core, core.marketIds.wbtc, parseBtc(`${360}`));
      await checkBorrowCap(core, core.marketIds.weEth, parseEther(`${5_000}`));

      // LTVs
      await checkMinCollateralization(core, core.marketIds.honey, TargetCollateralization.Base);
      await checkMinCollateralization(core, core.marketIds.usdc, TargetCollateralization.Base);
      await checkMinCollateralization(core, core.marketIds.usdt, TargetCollateralization._120);
      await checkMinCollateralization(core, core.marketIds.usde, TargetCollateralization._120);
      await checkMinCollateralization(core, core.marketIds.sUsde, TargetCollateralization._120);
      await checkMinCollateralization(core, core.marketIds.eBtc, TargetCollateralization._133);
      await checkMinCollateralization(core, core.marketIds.weEth, TargetCollateralization._133);
      await checkMinCollateralization(core, core.marketIds.stone, TargetCollateralization._133);
      await checkMinCollateralization(core, core.marketIds.lbtc, TargetCollateralization._133);

      // Liquidation Penalties
      await checkLiquidationPenalty(core, core.marketIds.honey, TargetLiquidationPenalty._6);
      await checkLiquidationPenalty(core, core.marketIds.usdc, TargetLiquidationPenalty._6);
      await checkLiquidationPenalty(core, core.marketIds.usdt, TargetLiquidationPenalty._7);
      await checkLiquidationPenalty(core, core.marketIds.usde, TargetLiquidationPenalty._7);
      await checkLiquidationPenalty(core, core.marketIds.sUsde, TargetLiquidationPenalty._7);
      await checkLiquidationPenalty(core, core.marketIds.eBtc, TargetLiquidationPenalty._8_5);
      await checkLiquidationPenalty(core, core.marketIds.weEth, TargetLiquidationPenalty._8_5);
      await checkLiquidationPenalty(core, core.marketIds.stone, TargetLiquidationPenalty._8_5);
      await checkLiquidationPenalty(core, core.marketIds.lbtc, TargetLiquidationPenalty._8_5);
    },
  };
}

doDryRunAndCheckDeployment(main);

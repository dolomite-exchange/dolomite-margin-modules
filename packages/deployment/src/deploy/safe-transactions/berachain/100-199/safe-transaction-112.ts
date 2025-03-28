import { parseEther } from 'ethers/lib/utils';
import { TargetCollateralization } from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetMinCollateralization,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkBorrowCap, checkMinCollateralization, checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increase the supply cap for various assets
 * - Increase the borrow cap for various assets
 * - Increase the LTV for various assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    // Supply caps
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usde, 100_000_000),
    // Borrow Caps
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usde, 50_000_000),
    // LTVs
    await encodeSetMinCollateralization(core, core.marketIds.wbtc, TargetCollateralization._125),
    await encodeSetMinCollateralization(core, core.marketIds.weth, TargetCollateralization._125),
    await encodeSetMinCollateralization(core, core.marketIds.eBtc, TargetCollateralization._128),
    await encodeSetMinCollateralization(core, core.marketIds.weEth, TargetCollateralization._128),
    await encodeSetMinCollateralization(core, core.marketIds.stone, TargetCollateralization._128),
    await encodeSetMinCollateralization(core, core.marketIds.lbtc, TargetCollateralization._128),
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
      await checkSupplyCap(core, core.marketIds.usde, parseEther(`${100_000_000}`));

      // Borrow caps
      await checkBorrowCap(core, core.marketIds.usde, parseEther(`${50_000_000}`));

      // LTVs
      await checkMinCollateralization(core, core.marketIds.wbtc, TargetCollateralization._125);
      await checkMinCollateralization(core, core.marketIds.weth, TargetCollateralization._125);
      await checkMinCollateralization(core, core.marketIds.eBtc, TargetCollateralization._128);
      await checkMinCollateralization(core, core.marketIds.weEth, TargetCollateralization._128);
      await checkMinCollateralization(core, core.marketIds.stone, TargetCollateralization._128);
      await checkMinCollateralization(core, core.marketIds.lbtc, TargetCollateralization._128);
    },
  };
}

doDryRunAndCheckDeployment(main);

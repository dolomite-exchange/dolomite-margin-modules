import { TargetCollateralization } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetIsBorrowOnly,
  encodeSetIsCollateralOnly,
  encodeSetMinCollateralization,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsBorrowOnly,
  checkBorrowCap,
  checkIsCollateralOnly,
  checkSupplyCap,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Enable e-mode risk settings for USDa and sUSDa
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;
  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, marketIds.sUsda, 50_000_000),

    await encodeSetSupplyCapWithMagic(core, marketIds.usda, 50_000_000),
    await encodeSetBorrowCapWithMagic(core, marketIds.usda, 40_000_000),
    await encodeSetMinCollateralization(core, marketIds.usda, TargetCollateralization._133),
    await encodeSetIsCollateralOnly(core, marketIds.usda, false),
    await encodeSetIsBorrowOnly(core, marketIds.usda, true),
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
      await checkSupplyCap(core, core.marketIds.sUsda, parseEther(`${50_000_000}`));

      await checkSupplyCap(core, core.marketIds.usda, parseEther(`${50_000_000}`));
      await checkBorrowCap(core, core.marketIds.usda, parseEther(`${40_000_000}`));
      await checkIsCollateralOnly(core, marketIds.usda, false);
      await checkAccountRiskOverrideIsBorrowOnly(core, marketIds.usda);
    },
  };
}

doDryRunAndCheckDeployment(main);

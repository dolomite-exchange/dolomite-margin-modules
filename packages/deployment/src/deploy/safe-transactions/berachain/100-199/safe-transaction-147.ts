import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetIsBorrowOnly,
  encodeSetIsCollateralOnly,
  encodeSetLiquidationPenalty,
  encodeSetMinCollateralization,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  checkAccountRiskOverrideIsBorrowOnly, checkBorrowCap,
  checkIsCollateralOnly, checkLiquidationPenalty, checkMinCollateralization,
  checkSupplyCap,
} from '../../../../utils/invariant-utils';
import { parseEther } from 'ethers/lib/utils';

/**
 * This script encodes the following transactions:
 * - Delist stBTC
 * - Update risk for SBTC, ylStETH
 * - Update caps for rsETH and rswETH
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetIsBorrowOnly(core, core.marketIds.stBtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.stBtc, true),

    await encodeSetIsBorrowOnly(core, core.marketIds.ylFbtc, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.ylFbtc, true),

    await encodeSetIsBorrowOnly(core, core.marketIds.ylStEth, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.ylStEth, true),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.sbtc, 25),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.sbtc, 10),
    await encodeSetMinCollateralization(core, core.marketIds.sbtc, TargetCollateralization._133),
    await encodeSetLiquidationPenalty(core, core.marketIds.sbtc, TargetLiquidationPenalty._9),

    await encodeSetSupplyCapWithMagic(core, core.marketIds.rsEth, 1),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.rswEth, 1),

    await encodeSetMinCollateralization(core, core.marketIds.ylStEth, TargetCollateralization._150),
    await encodeSetLiquidationPenalty(core, core.marketIds.ylStEth, TargetLiquidationPenalty._15),
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
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.stBtc);
      await checkIsCollateralOnly(core, core.marketIds.stBtc, true);

      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.ylFbtc);
      await checkIsCollateralOnly(core, core.marketIds.ylFbtc, true);

      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.ylStEth);
      await checkIsCollateralOnly(core, core.marketIds.ylStEth, true);

      await checkSupplyCap(core, core.marketIds.sbtc, parseEther(`${25}`));
      await checkBorrowCap(core, core.marketIds.sbtc, parseEther(`${10}`));
      await checkMinCollateralization(core, core.marketIds.sbtc, TargetCollateralization._133);
      await checkLiquidationPenalty(core, core.marketIds.sbtc, TargetLiquidationPenalty._9);

      await checkSupplyCap(core, core.marketIds.rsEth, parseEther(`${1}`));

      await checkSupplyCap(core, core.marketIds.rswEth, parseEther(`${1}`));

      await checkMinCollateralization(core, core.marketIds.ylStEth, TargetCollateralization._150);
      await checkLiquidationPenalty(core, core.marketIds.ylStEth, TargetLiquidationPenalty._15);
    },
  };
}

doDryRunAndCheckDeployment(main);

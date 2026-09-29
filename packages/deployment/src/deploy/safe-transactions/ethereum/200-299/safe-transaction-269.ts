import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeReportCard } from '../../../../utils/encoding/report-card-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeSetBorrowCap, encodeSetIsCollateralOnly, encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adjust wsrUSD cap
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  await encodeReportCard(
    core,
    [
      core.chainlinkPriceOracleV3,
      core.redstonePriceOracleV3,
      core.chroniclePriceOracleV3,
      core.constantPriceOracle,
      core.erc4626Oracle,
      core.twapPriceOracleV3,
    ],
  );

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.aave, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.stcUsd, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.sUsde, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.cUsd, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.rUsd, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.solvBtc, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.crv, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.link, ONE_BI),

    await encodeSetBorrowCap(core, core.marketIds.cUsd, ONE_BI),
    await encodeSetBorrowCap(core, core.marketIds.rUsd, ONE_BI),
    await encodeSetBorrowCap(core, core.marketIds.link, ONE_BI),

    await encodeSetIsCollateralOnly(core, core.marketIds.rUsd, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.link, true),
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
    },
  };
}

doDryRunAndCheckDeployment(main);

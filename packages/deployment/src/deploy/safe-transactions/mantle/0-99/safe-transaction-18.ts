import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - For all markets that specifically have liquidator proxy v4, it adds liquidator proxy v5
 *   and removes liquidator proxy v4
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  const marketsWithV4Liquidator: number[] = [];

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < numMarkets.toNumber(); i++) {
    const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(i);
    if (liquidators.includes(core.liquidatorProxyV4.address)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
          'liquidatorAssetRegistry',
          'ownerAddLiquidatorToAssetWhitelist',
          [i, core.liquidatorProxyV6.address],
        ),
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
          'liquidatorAssetRegistry',
          'ownerRemoveLiquidatorFromAssetWhitelist',
          [i, core.liquidatorProxyV4.address],
        ),
      );
      marketsWithV4Liquidator.push(i);
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      for (const marketId of marketsWithV4Liquidator) {
        assertHardhatInvariant(
          await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(marketId, core.liquidatorProxyV6.address),
          `Market [${marketId}] should have liquidator proxy v5 whitelisted`,
        );
        assertHardhatInvariant(
          !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
            marketId,
            core.liquidatorProxyV4.address,
          )),
          `Market [${marketId}] should not have liquidator proxy v4 whitelisted`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

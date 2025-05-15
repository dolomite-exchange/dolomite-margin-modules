import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const LIQUIDATOR_PROXY_V5_ADDRESS = '0x1506f80d2FD5fbeF2424573EC86E5481C972B99a';

/**
 * This script encodes the following transactions:
 * - For all markets that specifically have the liquidator proxy v5, it adds the liquidator proxy v6
 *   and removes liquidator proxy v5
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  const marketsWithV5Liquidator: number[] = [];

  const liquidatorProxyV6Address = core.liquidatorProxyV6.address; // After deployment, this will be new address

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < numMarkets.toNumber(); i++) {
    const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(i);
    if (liquidators.includes(LIQUIDATOR_PROXY_V5_ADDRESS)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
          'liquidatorAssetRegistry',
          'ownerAddLiquidatorToAssetWhitelist',
          [i, liquidatorProxyV6Address],
        ),
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
          'liquidatorAssetRegistry',
          'ownerRemoveLiquidatorFromAssetWhitelist',
          [i, LIQUIDATOR_PROXY_V5_ADDRESS],
        ),
      );
      marketsWithV5Liquidator.push(i);
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
      for (const marketId of marketsWithV5Liquidator) {
        assertHardhatInvariant(
          await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(marketId, liquidatorProxyV6Address),
          `Market [${marketId}] should have liquidator proxy v6 whitelisted`,
        );
        assertHardhatInvariant(
          !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
            marketId,
            LIQUIDATOR_PROXY_V5_ADDRESS,
          )),
          `Market [${marketId}] should not have liquidator proxy v5 whitelisted`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

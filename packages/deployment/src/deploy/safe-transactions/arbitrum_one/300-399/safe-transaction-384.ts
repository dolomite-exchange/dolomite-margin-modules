import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { isIsolationModeByMarketId } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the GenericTraderProxy as a global operator of Dolomite Margin
 * - Sets the LiquidatorProxyV4 as a global operator of Dolomite Margin
 * - For each isolation mode asset, adds the LiquidatorProxyV4 to the LiquidatorAssetRegistry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      core.genericTraderProxy.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      core.liquidatorProxyV4.address,
      true,
    ]),
  );

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; numMarkets.gt(i); i++) {
    if (await isIsolationModeByMarketId(i, core)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'liquidatorAssetRegistry',
          'ownerAddLiquidatorToAssetWhitelist',
          [i, core.liquidatorProxyV4.address],
        ),
      );
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(core.genericTraderProxy.address),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(core.liquidatorProxyV4.address),
        'Invalid global operator',
      );

      const numMarkets = await core.dolomiteMargin.getNumMarkets();
      for (let i = 0; numMarkets.gt(i); i++) {
        if (await isIsolationModeByMarketId(i, core)) {
          assertHardhatInvariant(
            await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(i, core.liquidatorProxyV4.address),
            'Invalid liquidator proxy',
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

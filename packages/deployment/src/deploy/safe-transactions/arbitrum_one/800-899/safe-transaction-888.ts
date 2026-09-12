import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Upgrades the GLV liquidator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGlvBtc, core.freezableLiquidatorProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGlvBtc, core.liquidatorProxyV6.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGlvEth, core.freezableLiquidatorProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGlvEth, core.liquidatorProxyV6.address],
    ),
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
      assertHardhatInvariant(
        (await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvBtc,
          core.liquidatorProxyV6.address
        )),
        "liquidator v6 not valid"
      );
      assertHardhatInvariant(
        (await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvEth,
          core.liquidatorProxyV6.address
        )),
        "liquidator v6 not valid"
      );
      assertHardhatInvariant(
        (await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvBtc,
          core.freezableLiquidatorProxy.address
        )),
        "Freezable liquidator not valid"
      );
      assertHardhatInvariant(
        (await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvEth,
          core.freezableLiquidatorProxy.address
        )),
        "Freezable liquidator not valid"
      );
      assertHardhatInvariant(
        !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvBtc,
          core.hhUser1.address
        )),
        "Invalid liquidator"
      );
      assertHardhatInvariant(
        !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
          core.marketIds.dGlvEth,
          core.hhUser1.address
        )),
        "Invalid liquidator"
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

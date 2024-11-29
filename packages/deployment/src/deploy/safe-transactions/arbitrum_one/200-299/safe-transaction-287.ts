import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Executes #276 and #277
 * - Removes jUSDC V2 from the freezable liquidator whitelist
 * - Adds gmETH (SS) to the V4 + freezable whitelist
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { delayedMultiSig: core.delayedMultiSig },
      'delayedMultiSig',
      'executeMultipleTransactions',
      [Array.from({ length: 27 }, (_, i) => i + 815)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerRemoveLiquidatorFromAssetWhitelist',
      [core.marketIds.djUsdcV2, core.freezableLiquidatorProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGmEth, core.liquidatorProxyV4.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dGmEth, core.freezableLiquidatorProxy.address],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      const jUsdcLiquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(core.marketIds.djUsdcV2);
      expect(jUsdcLiquidators.length).to.eq(1);
      expect(jUsdcLiquidators[0]).to.eq(core.liquidatorProxyV4.address);

      const gmBtcLiquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(
        core.marketIds.dGmBtc,
      );
      expect(gmBtcLiquidators.length).to.eq(2);
      expect(gmBtcLiquidators[0]).to.eq(core.liquidatorProxyV4.address);
      expect(gmBtcLiquidators[1]).to.eq(core.freezableLiquidatorProxy.address);

      const gmEthLiquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(
        core.marketIds.dGmEth,
      );
      expect(gmEthLiquidators.length).to.eq(2);
      expect(gmEthLiquidators[0]).to.eq(core.liquidatorProxyV4.address);
      expect(gmEthLiquidators[1]).to.eq(core.freezableLiquidatorProxy.address);
    },
  };
}

doDryRunAndCheckDeployment(main);

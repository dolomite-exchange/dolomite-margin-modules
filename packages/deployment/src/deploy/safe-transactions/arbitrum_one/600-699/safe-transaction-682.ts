import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getMaxDeploymentVersionAddressByDeploymentKey } from 'packages/deployment/src/utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

/**
 * This script encodes the following transactions:
 * - Remove the unwrapper as a GLP trusted token converter
 * - Remove all liquidators except the dead address
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const unwrapperAddress = await getMaxDeploymentVersionAddressByDeploymentKey(
    'GLPIsolationModeUnwrapperTrader',
    network,
  );
  assertHardhatInvariant(
    await core.gmxEcosystem.live.dGlp.isTokenConverterTrusted(unwrapperAddress),
    'Expected unwrapper to be trusted',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.gmxEcosystem.live, 'dGlp', 'setIsTokenConverterTrusted', [
      unwrapperAddress,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [core.marketIds.dfsGlp, DEAD_ADDRESS],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerRemoveLiquidatorFromAssetWhitelist',
      [core.marketIds.dfsGlp, core.liquidatorProxyV6.address],
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
      const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(core.marketIds.dfsGlp);

      assertHardhatInvariant(liquidators.length === 1, 'Expected 1 liquidator');
      assertHardhatInvariant(liquidators[0] === DEAD_ADDRESS, 'Expected dead address');
      assertHardhatInvariant(
        !(await core.gmxEcosystem.live.dGlp.isTokenConverterTrusted(unwrapperAddress)),
        'Expected unwrapper to be untrusted',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

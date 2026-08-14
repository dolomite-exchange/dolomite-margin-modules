import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the GLV router and reader to V2.2c
 * - Updates the GMX exchange router and reader to V2.2c
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
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvRouter',
      [core.glvEcosystem.glvRouter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvReader',
      [core.glvEcosystem.glvReader.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvHandler',
      [core.glvEcosystem.glvHandler.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registry',
      'ownerSetGmxReader',
      [core.gmxV2Ecosystem.gmxReader.address],
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
        (await core.glvEcosystem.live.registry.glvRouter()) === core.glvEcosystem.glvRouter.address,
        'Invalid GLV router',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.registry.glvReader()) === core.glvEcosystem.glvReader.address,
        'Invalid GLV reader',
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxExchangeRouter())
          === core.gmxV2Ecosystem.gmxExchangeRouter.address,
        'Invalid GMX exchange router',
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxReader()) === core.gmxV2Ecosystem.gmxReader.address,
        'Invalid GMX reader',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

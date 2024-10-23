import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the GMXExchangeRouter on the gmxV2 registry to the new address
 * - Sets the GMXReader on the gmxV2 registry to the new address
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  core.gmxV2Ecosystem.live.registry
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouterV2.address],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxReader',
      [core.gmxV2Ecosystem.gmxReaderV2.address],
    )
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxExchangeRouter()) === core.gmxV2Ecosystem.gmxExchangeRouterV2.address,
        'Invalid gmx exchange router'
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxReader()) === core.gmxV2Ecosystem.gmxReaderV2.address,
        'Invalid gmx reader'
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

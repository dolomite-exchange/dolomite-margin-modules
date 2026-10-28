import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import gmxVaults from '@dolomite-exchange/modules-glp/test/all-staked-gmx-vaults.json';
import { IGMXIsolationModeTokenVaultV2__factory } from '@dolomite-exchange/modules-glp/src/types';

const newGmxRewardsRouterAddress = '0xF6Ba2B1a33c5bdA5D7Cd5FD971E859430F465719';

/**
 * This script updates the GMX reward router on the GMX registry.
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  // let nonce = await core.hhUser1.getTransactionCount();
  // for (const gmxVault of gmxVaults) {
  //   const vault = IGMXIsolationModeTokenVaultV2__factory.connect(gmxVault.vault, core.hhUser1);
  //
  //   await vault.ownerUnstakeGmx({ nonce: nonce++, gasLimit: 10_000_000 });
  // }

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem.live,
      'gmxRegistry',
      'ownerSetGmxRewardsRouter',
      [newGmxRewardsRouterAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem.live,
      'gmxRegistry',
      'ownerSetIsHandler',
      [core.gnosisSafeAddress, true],
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
        (await core.gmxEcosystem.live.gmxRegistry.gmxRewardsRouter()).toLowerCase()
        === newGmxRewardsRouterAddress.toLowerCase(),
        'Invalid GMX reward router',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

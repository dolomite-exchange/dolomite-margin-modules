import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Update the GMX V2 Library
 * - Update the GLV token vault on GLV-BTC and GLV-ETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave('GmxV2Library', [], 'GmxV2LibraryV9');

  const glvTokenVaultAddress = await deployContractAndSave(
    'GlvIsolationModeTokenVaultV1',
    [core.tokens.weth.address, network],
    'GlvIsolationModeTokenVaultImplementationV2',
    {
      ...core.libraries.tokenVaultActionsImpl,
      ...core.glvEcosystem.live.glvLibraryMap,
      GmxV2Library: gmxV2LibraryAddress,
    },
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.glvEcosystem.live.glvBtc.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [glvTokenVaultAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.glvEcosystem.live.glvEth.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [glvTokenVaultAddress],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.factory.userVaultImplementation()) === glvTokenVaultAddress,
        'Invalid vault implementation on glvBTC',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.factory.userVaultImplementation()) === glvTokenVaultAddress,
        'Invalid vault implementation on glvETH',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

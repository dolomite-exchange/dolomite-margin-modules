import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets up the PT-mETH ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const ptUsdeJulyImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtUSDeJul2024IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );
  const ptUsdeDecemberImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtUSDeDec2024IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );
  const ptMEthImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtmETHDec2024IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );
  const ptMntImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtMntOct2024IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );

  const pendle = core.pendleEcosystem;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: pendle.usdeJul2024.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [ptUsdeJulyImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: pendle.usdeDec2024.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [ptUsdeDecemberImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: pendle.methDec2024.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [ptMEthImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: pendle.mntOct2024.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [ptMntImplementationAddress],
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
        await pendle.usdeJul2024.factory.userVaultImplementation() === ptUsdeJulyImplementationAddress,
        'Invalid PT-USDe (JUL) user vault implementation',
      );
      assertHardhatInvariant(
        await pendle.usdeDec2024.factory.userVaultImplementation() === ptUsdeDecemberImplementationAddress,
        'Invalid PT-USDe (DEC) user vault implementation',
      );
      assertHardhatInvariant(
        await pendle.methDec2024.factory.userVaultImplementation() === ptMEthImplementationAddress,
        'Invalid PT-mETH (DEC) user vault implementation',
      );
      assertHardhatInvariant(
        await pendle.mntOct2024.factory.userVaultImplementation() === ptMntImplementationAddress,
        'Invalid PT-MNT (OCT) user vault implementation',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

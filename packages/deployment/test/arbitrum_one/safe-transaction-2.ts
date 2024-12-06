import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
} from '../../src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../src/utils/dry-run-utils';
import getScriptName from '../../src/utils/get-script-name';
import { filterVaultsByType } from 'packages/base/test/utils/ecosystem-utils/deployed-vaults';
import { IsolationModeVaultType } from 'packages/deployment/src/deploy/isolation-mode/arbitrum';
import { D_ARB_MAP } from 'packages/base/src/utils/constants';

/**
 * This test script encodes the following transactions:
 * - Deploys a new GMX V2 Library
 * - Sets the new user vault implementation for each GM-Factory (currently just one in the deployedVaultsMap)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  // Test updating all GMX V2 vaults to the new library
  const gmxV2LibraryAddress = await deployContractAndSave('GmxV2Library', [], 'GmxV2LibraryV10');
  const transactions: EncodedTransaction[] = [];

  for (const deployedVault of filterVaultsByType(core.deployedVaultsMap, IsolationModeVaultType.GmxV2)) {
    await deployedVault.deployNewVaultImplementation({ 'GmxV2Library': gmxV2LibraryAddress });
    transactions.push(await deployedVault.encodeSetUserVaultImplementation(core));
  }

  // Update the ARB map specifically
  const arbVaultAddress = await core.deployedVaultsMap[D_ARB_MAP[network].marketId].deployNewVaultImplementation({});
  transactions.push(await core.deployedVaultsMap[D_ARB_MAP[network].marketId].encodeSetUserVaultImplementation(core));

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      for (const deployedVault of filterVaultsByType(core.deployedVaultsMap, IsolationModeVaultType.GmxV2)) {
        assertHardhatInvariant(
          (await deployedVault.factory.userVaultImplementation()) === deployedVault.implementationAddress,
          `Invalid user vault implementation for ${deployedVault.contractName}`,
        );
      }

      assertHardhatInvariant(
        (await core.arbEcosystem.live.dArb.userVaultImplementation()) === arbVaultAddress,
        `Invalid user vault implementation for ARB map`,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  getMaxDeploymentVersionNameByDeploymentKey,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';

/**
 * This script encodes the following transactions:
 * - Deploys the new IsolationModeTokenVaultActionsImplementation
 * - Updates all isolation mode markets with new token vault
 * - Deploys a new async unwrapper and wrapper library
 * - Updates GLV & GmxV2 markets with new unwrapper and wrapper
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const safeDelegateCallLibAddress = await deployContractAndSave('SafeDelegateCallLib', [], 'SafeDelegateCallLibV1');
  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV9',
    { SafeDelegateCallLib: safeDelegateCallLibAddress },
  );

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.isUpgradeable) {
      transactions.push(
        await deployedVault.deployNewVaultAndEncodeUpgradeTransaction(
          core,
          { IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress }
        ),
      );
    }
  }

  const glvLibraryAddress = await deployContractAndSave(
    'GlvLibrary',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('GlvLibrary', 1),
  );
  const asyncUnwrapperImplAddress = await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    'AsyncIsolationModeUnwrapperTraderImplV5',
  );
  const asyncWrapperImplAddress = await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    'AsyncIsolationModeWrapperTraderImplV4',
  );

  const glvLibraryMap = { GlvLibrary: glvLibraryAddress };
  const asyncUnwrapperMap = { AsyncIsolationModeUnwrapperTraderImpl: asyncUnwrapperImplAddress };
  const asyncWrapperMap = { AsyncIsolationModeWrapperTraderImpl: asyncWrapperImplAddress };

  const glvUnwrapperAddress = await deployContractAndSave(
    'GlvIsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeUnwrapperTraderImplementationV4',
    { ...glvLibraryMap, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...asyncUnwrapperMap }
  );
  const glvWrapperAddress = await deployContractAndSave(
    'GlvIsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeWrapperTraderImplementationV4',
    { ...glvLibraryMap, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...asyncWrapperMap }
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'wrapperProxy', 'upgradeTo', [
      glvWrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'wrapperProxy', 'upgradeTo', [
      glvWrapperAddress,
    ]),
  );

  const gmxV2UnwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV13',
    { ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...asyncUnwrapperMap },
  );
  const gmxV2WrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV12',
    { ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...asyncWrapperMap },
  );

  const deployedGmxV2Vaults = core.deployedVaults.filter(vault => vault.vaultType === IsolationModeVaultType.GmxV2);
  if (deployedGmxV2Vaults.length !== core.gmxV2Ecosystem.live.allGmMarkets.length) {
    throw new Error('Number of deployed GMX v2 vaults does not match number of GMX v2 markets');
  }

  for (const gmMarket of core.gmxV2Ecosystem.live.allGmMarkets) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'unwrapperProxy', 'upgradeTo', [gmxV2UnwrapperImplementationAddress]),
      await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'wrapperProxy', 'upgradeTo', [gmxV2WrapperImplementationAddress]),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      for (const deployedVault of core.deployedVaults) {
        assertHardhatInvariant(
          (await deployedVault.factory.userVaultImplementation()) === deployedVault.implementationAddress,
          `Invalid user vault implementation for ${deployedVault.contractName}`,
        );
      }
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.unwrapperProxy.implementation()) === glvUnwrapperAddress,
        'Invalid GLV wrapper implementation',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.unwrapperProxy.implementation()) === glvUnwrapperAddress,
        'Invalid GLV wrapper implementation',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.wrapperProxy.implementation()) === glvWrapperAddress,
        'Invalid GLV wrapper implementation',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.wrapperProxy.implementation()) === glvWrapperAddress,
        'Invalid GLV wrapper implementation',
      );
      for (const gmMarket of core.gmxV2Ecosystem.live.allGmMarkets) {
        assertHardhatInvariant(
          (await gmMarket.unwrapperProxy.implementation()) === gmxV2UnwrapperImplementationAddress,
          'Invalid GMX v2 unwrapper implementation',
        );
        assertHardhatInvariant(
          (await gmMarket.wrapperProxy.implementation()) === gmxV2WrapperImplementationAddress,
          'Invalid GMX v2 wrapper implementation',
        );
      }

      assertHardhatInvariant(
        (await core.dolomiteAccountRegistry.getTransferTokenOverride(core.tokens.arb.address)) === ADDRESS_ZERO,
        'Dolomite account registry not upgraded',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

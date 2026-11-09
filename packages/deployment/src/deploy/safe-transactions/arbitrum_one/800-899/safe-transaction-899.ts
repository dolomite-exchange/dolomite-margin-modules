import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import {
  getMaxDeploymentVersionAddressByDeploymentKey,
  setupCoreProtocol,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Update GLV to use the new GlvLibrary
 * - Update both GLV markets to use the new token vault implementation
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const glvLibraryAddress = await deployContractAndSave('GlvLibrary', [], 'GlvLibraryV5');
  const gmxV2TraderLibraryMap = core.gmxV2Ecosystem.live.gmxV2TraderLibraryMap;

  const glvWrapperImplAddress = await deployContractAndSave(
    'GlvIsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeWrapperTraderImplementationV6',
    { GlvLibrary: glvLibraryAddress, ...gmxV2TraderLibraryMap, ...core.libraries.wrapperTraderImpl },
  );
  const glvUnwrapperImplAddress = await deployContractAndSave(
    'GlvIsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeUnwrapperTraderImplementationV6',
    { GlvLibrary: glvLibraryAddress, ...gmxV2TraderLibraryMap, ...core.libraries.unwrapperTraderImpl },
  );
  const glvTokenVaultImplAddress = await deployContractAndSave(
    'GlvIsolationModeTokenVaultV1',
    [core.tokens.weth.address, core.config.network],
    'GlvIsolationModeTokenVaultImplementationV10',
    {
      GlvLibrary: glvLibraryAddress,
      ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap,
      ...core.libraries.tokenVaultActionsImpl,
      AsyncIsolationModeTokenVaultV1ActionsImpl: getMaxDeploymentVersionAddressByDeploymentKey(
        'AsyncIsolationModeTokenVaultV1ActionsImpl',
        network,
      ),
    },
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'wrapperProxy', 'upgradeTo', [
      glvWrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'wrapperProxy', 'upgradeTo', [
      glvWrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live.glvBtc,
      'factory',
      'ownerSetUserVaultImplementation',
      [glvTokenVaultImplAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live.glvEth,
      'factory',
      'ownerSetUserVaultImplementation',
      [glvTokenVaultImplAddress],
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
        (await core.glvEcosystem.live.glvBtc.factory.userVaultImplementation()) === glvTokenVaultImplAddress,
        'GLV-BTC token vault is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.factory.userVaultImplementation()) === glvTokenVaultImplAddress,
        'GLV-ETH token vault is incorrect',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

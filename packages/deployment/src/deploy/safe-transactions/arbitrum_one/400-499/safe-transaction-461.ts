import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the new GLV vault
 * - Deploys the new GLV unwrapper and wrapper implementations
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const glvRegistryAddress = await deployContractAndSave('GlvRegistry', [], 'GlvRegistryImplementationV2');

  const glvLibraryAddress = await deployContractAndSave('GlvLibrary', [], 'GlvLibraryV2');
  const glvLibraryMap = { GlvLibrary: glvLibraryAddress };
  const glvUnwrapperAddress = await deployContractAndSave(
    'GlvIsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeUnwrapperTraderImplementationV3',
    { ...glvLibraryMap, ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap, ...core.libraries.unwrapperTraderImpl },
  );
  const glvWrapperAddress = await deployContractAndSave(
    'GlvIsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeWrapperTraderImplementationV3',
    { ...glvLibraryMap, ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap, ...core.libraries.wrapperTraderImpl },
  );
  const glvTokenVaultAddress = await deployContractAndSave(
    'GlvIsolationModeTokenVaultV1',
    [core.tokens.weth.address, core.config.network],
    'GlvIsolationModeTokenVaultImplementationV3',
    { ...glvLibraryMap, ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap, ...core.libraries.tokenVaultActionsImpl },
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live, 'registryProxy', 'upgradeTo', [
      glvRegistryAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [core.glvEcosystem.glvTokens.wbtcUsdc.glvToken.address, core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [core.glvEcosystem.glvTokens.wbtcUsdc.glvToken.address, core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [core.glvEcosystem.glvTokens.wethUsdc.glvToken.address, core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [core.glvEcosystem.glvTokens.wethUsdc.glvToken.address, core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'wrapperProxy', 'upgradeTo', [
      glvWrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live.glvBtc,
      'factory',
      'ownerSetUserVaultImplementation',
      [glvTokenVaultAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'wrapperProxy', 'upgradeTo', [
      glvWrapperAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live.glvEth,
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
        (await core.glvEcosystem.live.registry.glvTokenToGmMarketForDeposit(
          core.glvEcosystem.glvTokens.wbtcUsdc.glvToken.address,
        )) === core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address,
        'GLV-BTC deposit GM token is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.registry.glvTokenToGmMarketForWithdrawal(
          core.glvEcosystem.glvTokens.wbtcUsdc.glvToken.address,
        )) === core.gmxV2Ecosystem.gmTokens.btcUsd.marketToken.address,
        'GLV-BTC withdrawal GM token is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.registry.glvTokenToGmMarketForDeposit(
          core.glvEcosystem.glvTokens.wethUsdc.glvToken.address,
        )) === core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        'GLV-ETH deposit GM token is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.registry.glvTokenToGmMarketForWithdrawal(
          core.glvEcosystem.glvTokens.wethUsdc.glvToken.address,
        )) === core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
        'GLV-ETH withdrawal GM token is incorrect',
      );

      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.unwrapperProxy.implementation()) === glvUnwrapperAddress,
        'GLV-BTC unwrapper is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.wrapperProxy.implementation()) === glvWrapperAddress,
        'GLV-BTC wrapper is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvBtc.factory.userVaultImplementation()) === glvTokenVaultAddress,
        'GLV-BTC token vault is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.unwrapperProxy.implementation()) === glvUnwrapperAddress,
        'GLV-ETH unwrapper is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.wrapperProxy.implementation()) === glvWrapperAddress,
        'GLV-ETH wrapper is incorrect',
      );
      assertHardhatInvariant(
        (await core.glvEcosystem.live.glvEth.factory.userVaultImplementation()) === glvTokenVaultAddress,
        'GLV-ETH token vault is incorrect',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

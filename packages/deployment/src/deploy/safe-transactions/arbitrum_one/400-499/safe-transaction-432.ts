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
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the GMXExchangeRouter on the gmxV2 registry to the new address
 * - Sets the GMXReader on the gmxV2 registry to the new address
 * - Updates the GMX V2 wrappers/unwrappers to adjust for the new deposit/withdraw callbacks
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  core.gmxV2Ecosystem.live.registry;
  const unwrapperProxies = core.gmxV2Ecosystem.live.allGmMarkets.map(m => m.unwrapperProxy);
  const wrapperProxies = core.gmxV2Ecosystem.live.allGmMarkets.map(m => m.wrapperProxy);

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV12',
    { ...core.libraries.unwrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV11',
    { ...core.libraries.wrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouterV2.address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxReader',
      [core.gmxV2Ecosystem.gmxReaderV2.address],
    ),
  );

  for (let i = 0; i < unwrapperProxies.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { unwrapperProxy: unwrapperProxies[i] },
        'unwrapperProxy',
        'upgradeTo',
        [unwrapperImplementationAddress],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { wrapperProxy: wrapperProxies[i] },
        'wrapperProxy',
        'upgradeTo',
        [wrapperImplementationAddress],
      ),
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
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxExchangeRouter()) ===
          core.gmxV2Ecosystem.gmxExchangeRouterV2.address,
        'Invalid gmx exchange router',
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxReader()) === core.gmxV2Ecosystem.gmxReaderV2.address,
        'Invalid gmx reader',
      );
      for (let i = 0; i < unwrapperProxies.length; i++) {
        assertHardhatInvariant(
          (await unwrapperProxies[i].implementation()) === unwrapperImplementationAddress,
          `Invalid unwrapper implementation for ${unwrapperProxies[i].address}`,
        );
        assertHardhatInvariant(
          (await wrapperProxies[i].implementation()) === wrapperImplementationAddress,
          `Invalid wrapper implementation for ${wrapperProxies[i].address}`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

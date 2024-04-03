import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import Deployments from '../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys new GMX V2 library and ActionsImpl library
 * - Deploys a new Token Vault for each GM token
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV4',
  );
  const gmxV2Libraries = { GmxV2Library: gmxV2LibraryAddress };

  const unwrapperTraderLibAddress = await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    'AsyncIsolationModeUnwrapperTraderImplV2',
  );
  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV4',
    {
      ...gmxV2Libraries,
      AsyncIsolationModeUnwrapperTraderImpl: unwrapperTraderLibAddress,
    },
  );

  const wrapperTraderLibAddress = await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    'AsyncIsolationModeWrapperTraderImplV2',
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV4',
    {
      ...gmxV2Libraries,
      AsyncIsolationModeWrapperTraderImpl: wrapperTraderLibAddress,
    },
  );

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultV8',
    { ...core.tokenVaultActionsLibraries, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const factories = [
    core.gmxEcosystemV2.live.gmArb.factory,
    core.gmxEcosystemV2.live.gmBtc.factory,
    core.gmxEcosystemV2.live.gmEth.factory,
    core.gmxEcosystemV2.live.gmLink.factory,
  ];
  const unwrappers = [
    core.gmxEcosystemV2.live.gmArb.unwrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.unwrapperProxy,
    core.gmxEcosystemV2.live.gmEth.unwrapperProxy,
    core.gmxEcosystemV2.live.gmLink.unwrapperProxy,
  ];
  const wrappers = [
    core.gmxEcosystemV2.live.gmArb.wrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.wrapperProxy,
    core.gmxEcosystemV2.live.gmEth.wrapperProxy,
    core.gmxEcosystemV2.live.gmLink.wrapperProxy,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i += 1) {
    const factory = factories[i];
    const unwrapper = unwrappers[i];
    const wrapper = wrappers[i];

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory },
        'factory',
        'ownerSetUserVaultImplementation',
        [gmxV2TokenVault.address],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { unwrapper },
        'unwrapper',
        'upgradeTo',
        [unwrapperImplementationAddress],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { wrapper },
        'wrapper',
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
    },
    invariants: async () => {
      await Promise.all(
        factories.map(async (factory, i) => {
          assertHardhatInvariant(
            await factory.userVaultImplementation() === gmxV2TokenVaultAddress,
            `Invalid token vault at index [${i}]`,
          );
          assertHardhatInvariant(
            await unwrappers[i].implementation() === unwrapperImplementationAddress,
            `Invalid unwrapper implementation at index [${i}]`,
          );
          assertHardhatInvariant(
            await wrappers[i].implementation() === wrapperImplementationAddress,
            `Invalid unwrapper implementation at index [${i}]`,
          );
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

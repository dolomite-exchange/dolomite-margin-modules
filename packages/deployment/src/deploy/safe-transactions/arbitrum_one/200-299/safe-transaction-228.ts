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

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new GMX V2 library and ActionsImpl library
 * - Deploys a new Token Vault for each GM token
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2Libraries = core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap;

  const tokenVaultActionsAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV5',
  );

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultImplementationV7',
    { IsolationModeTokenVaultV1ActionsImpl: tokenVaultActionsAddress, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const factories = [
    core.gmxV2Ecosystem.live.gmArbUsd.factory,
    core.gmxV2Ecosystem.live.gmBtcUsd.factory,
    core.gmxV2Ecosystem.live.gmEthUsd.factory,
    core.gmxV2Ecosystem.live.gmLinkUsd.factory,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i += 1) {
    const factory = factories[i];
    const transaction = await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    );
    transactions.push(transaction);
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
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

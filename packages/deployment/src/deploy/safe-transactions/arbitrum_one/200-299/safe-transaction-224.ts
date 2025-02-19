import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
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
 * - Allows ownerSetUserVaultImplementation and upgradeTo to be called on the delayed multi sig immediately
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV3',
  );
  const gmxV2Libraries = { GmxV2Library: gmxV2LibraryAddress };

  const tokenVaultActionsAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV4',
  );

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultImplementationV6',
    { ...{ IsolationModeTokenVaultV1ActionsImpl: tokenVaultActionsAddress }, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const factories = [
    core.gmxV2Ecosystem.live.gmArbUsd.factory,
    core.gmxV2Ecosystem.live.gmBtcUsd.factory,
    core.gmxV2Ecosystem.live.gmEthUsd.factory,
    core.gmxV2Ecosystem.live.gmLinkUsd.factory,
  ];
  const unwrappers = [
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapperProxy,
  ];
  const wrappers = [
    core.gmxV2Ecosystem.live.gmArbUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapperProxy,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i += 1) {
    const factory = factories[i];
    const unwrapper = unwrappers[i];
    const wrapper = wrappers[i];
    const transaction = await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    );
    transactions.push(
      transaction,
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { multisig: core.delayedMultiSig },
        'multisig',
        'setSelector',
        [factory.address, transaction.data.substring(0, 10), true],
      ),
    );

    const upgradeToSelector = (await unwrapper.populateTransaction.upgradeTo(ZERO_ADDRESS)).data!.substring(0, 10);
    transactions.push(
      transaction,
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { multisig: core.delayedMultiSig },
        'multisig',
        'setSelector',
        [unwrapper.address, upgradeToSelector, true],
      ),
    );
    transactions.push(
      transaction,
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { multisig: core.delayedMultiSig },
        'multisig',
        'setSelector',
        [wrapper.address, upgradeToSelector, true],
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
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

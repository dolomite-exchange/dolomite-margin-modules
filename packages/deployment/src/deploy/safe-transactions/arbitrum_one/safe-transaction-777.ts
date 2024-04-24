import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeTokenVaultV1__factory, GmxV2Registry__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { RegistryProxy__factory } from 'packages/base/src/types';

const GMX_BTC_PLACEHOLDER_ADDRESS = '0x47904963fc8b2340414262125aF798B9655E58Cd';

/**
 * This script encodes the following transactions:
 * - Deploys a new instance of the GMX V2 token vault with a new library
 * - Deploys a new instance of the GMX V2 registry
 * - Initialized the gm market token and corresponding index token on the registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV5',
  );
  const gmxV2Libraries = { GmxV2Library: gmxV2LibraryAddress };

  const gmxV2RegistryImplementationAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV2',
  );

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultV13',
    { ...core.libraries.tokenVaultActionsImpl, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);
  const gmxV2RegistryProxy = RegistryProxy__factory.connect(core.gmxEcosystemV2.live.registry.address, core.hhUser1);
  const gmxV2RegistryImplementation = GmxV2Registry__factory.connect(
    core.gmxEcosystemV2.live.registry.address,
    core.hhUser1
  );

  const factories = [
    core.gmxEcosystemV2.live.gmArb.factory,
    core.gmxEcosystemV2.live.gmBtc.factory,
    core.gmxEcosystemV2.live.gmEth.factory,
    core.gmxEcosystemV2.live.gmLink.factory,
  ];
  const indexTokens = [
    core.tokens.arb.address,
    GMX_BTC_PLACEHOLDER_ADDRESS,
    core.tokens.weth.address,
    core.tokens.link.address
  ];

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxV2RegistryProxy },
      'gmxV2RegistryProxy',
      'upgradeTo',
      [gmxV2RegistryImplementationAddress],
    ),
  );

  for (let i = 0; i < factories.length; i += 1) {
    const factory = factories[i];
    const marketToken = await factory.UNDERLYING_TOKEN();

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.gmxEcosystemV2.live,
        'registry',
        'ownerSetGmxMarketToIndexToken',
        [marketToken, indexTokens[i]],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory },
        'factory',
        'ownerSetUserVaultImplementation',
        [gmxV2TokenVault.address],
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
            await gmxV2RegistryImplementation.gmxMarketToIndexToken(
              await factory.UNDERLYING_TOKEN()
            ) === indexTokens[i],
            'Invalid index token for GMX market'
          );
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

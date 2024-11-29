import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
} from '@dolomite-exchange/modules-glp/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

async function checkState(core: CoreProtocolArbitrumOne, vaultV5: GMXIsolationModeTokenVaultV1) {
  const liveEcosystem = core.gmxEcosystem.live;
  assertHardhatInvariant(
    await liveEcosystem.dGmx.userVaultImplementation() === vaultV5.address,
    'Invalid gmxRewardsRouter',
  );
  assertHardhatInvariant(
    await liveEcosystem.gmxRegistry.gmxRewardsRouter() === core.gmxEcosystem.gmxRewardsRouterV3.address,
    'Invalid gmxRewardsRouter',
  );
}

const network = Network.ArbitrumOne;

/**
 * This script encodes the following transactions:
 * - Deploys and sets the new GMX isolation mode vault (for auto staking GMX rewards)
 * - Updates the GMX rewards router to the new address
 */
async function main(): Promise<DryRunOutput<typeof network>> {
  await getAndCheckSpecificNetwork(network);
  const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(network));

  const gmxIsolationModeVaultV6Address = await deployContractAndSave(
    'GMXIsolationModeTokenVaultV1',
    [],
    'GMXIsolationModeTokenVaultV6',
    core.libraries.tokenVaultActionsImpl,
  );
  const gmxIsolationModeVaultV6 = GMXIsolationModeTokenVaultV1__factory.connect(
    gmxIsolationModeVaultV6Address,
    core.governance,
  );

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetUserVaultImplementation',
      [gmxIsolationModeVaultV6.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistry',
      'ownerSetGmxRewardsRouter',
      [core.gmxEcosystem!.gmxRewardsRouterV3.address],
    ),
  ];

  return {
    core,
    upload: {
      transactions,
      chainId: network,
    },
    scriptName: getScriptName(__filename),
    invariants: () => checkState(core, gmxIsolationModeVaultV6),
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);

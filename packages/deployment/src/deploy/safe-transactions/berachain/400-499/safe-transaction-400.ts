import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { MetaVaultUpgradeableProxy__factory } from '@dolomite-exchange/modules-berachain/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ethers } from 'ethers';

/**
 * This script encodes the following transactions:
 * - Create the BerachainRewardsReader
 * - Update the Infrared meta vault + registry to expose new functions
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV3',
  );

  const registry = core.berachainRewardsEcosystem.live.registry;
  const registryProxy = core.berachainRewardsEcosystem.live.registryProxy;
  const bytecode = MetaVaultUpgradeableProxy__factory.bytecode;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registryProxy },
      'registryProxy',
      'upgradeTo',
      [registryImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultProxyCreationCode',
      [bytecode],
    ),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        await registryProxy.implementation() === registryImplementationAddress,
        'Invalid registry implementation',
      );
      assertHardhatInvariant(
        await registry.getMetaVaultProxyInitCodeHash() === ethers.utils.keccak256(bytecode),
        'Invalid meta vault creation code',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

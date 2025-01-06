import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployContractAndSave, EncodedTransaction } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';
import { getBerachainRewardsRegistryConstructorParams } from 'packages/berachain/src/berachain-constructors';
import { BerachainRewardsRegistry__factory } from 'packages/berachain/src/types';

type AcceptableNetworks = Network.Berachain;

/**
 * This script encodes the following transactions:
 * - 
 */
async function main(): Promise<DryRunOutput<AcceptableNetworks>> {
  const rawNetwork = await getAnyNetwork();
  if (rawNetwork !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network: ${rawNetwork}`));
  }
  const network = rawNetwork as AcceptableNetworks;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const metaVaultImplementationAddress = await deployContractAndSave(
    'BerachainRewardsMetaVault',
    []
  );
  const berachainRegistryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementation',
  );
  const berachainRegistryImplementation = BerachainRewardsRegistry__factory.connect(
    berachainRegistryImplementationAddress,
    core.hhUser1,
  );
  const berachainRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getBerachainRewardsRegistryConstructorParams(
      berachainRegistryImplementation,
      { address: metaVaultImplementationAddress } as any,
      core
    ),
    'BerachainRewardsRegistryProxy',
  );

  const bgtVaultImplementationAddress = await deployContractAndSave(
    'BGTIsolationModeTokenVaultV1',
    [],
    'BGTIsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl}
  );

  const transactions: EncodedTransaction[] = [];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

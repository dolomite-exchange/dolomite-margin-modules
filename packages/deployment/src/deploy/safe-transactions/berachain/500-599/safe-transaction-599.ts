import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { AdminRegistry__factory } from 'packages/admin/src/types/factories/contracts_coverage/AdminRegistry__factory';
import { getAdminRegistryProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';

/**
 * This script encodes the following transactions:
 * - Deploys AdminRegistry contract
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const adminRegistryImplementationAddress = await deployContractAndSave(
    'AdminRegistry',
    [core.dolomiteMargin.address],
    'AdminRegistryV1',
  );
  const adminRegistryImplementation = AdminRegistry__factory.connect(
    adminRegistryImplementationAddress,
    core.governance
  );

  const adminRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getAdminRegistryProxyConstructorParams(core, adminRegistryImplementation),
    'AdminRegistryProxy',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteRegistry: core.dolomiteRegistry },
      'dolomiteRegistry',
      'ownerSetAdminRegistry',
      [adminRegistryProxyAddress],
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
      assertHardhatInvariant(await core.dolomiteRegistry.adminRegistry() === adminRegistryProxyAddress, 'adminRegistry does not match');
    },
  };
}

doDryRunAndCheckDeployment(main);

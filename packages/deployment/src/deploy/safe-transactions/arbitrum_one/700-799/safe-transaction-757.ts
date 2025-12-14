import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Updates to GMX V2.2b (new reader and router)
 * - Updates to GLV V2.2b (new reader and router)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];

  const gmxRegistryImplAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV4',
  );
  const glvRegistryImplAddress = await deployContractAndSave(
    'GlvRegistry',
    [],
    'GlvRegistryImplementationV4',
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registryProxy',
      'upgradeTo',
      [gmxRegistryImplAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registryProxy',
      'upgradeTo',
      [glvRegistryImplAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registry',
      'ownerSetGmxReader',
      [core.gmxV2Ecosystem.gmxReader.address]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvRouter',
      [core.glvEcosystem.glvRouter.address]
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvReader',
      [core.glvEcosystem.glvReader.address]
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.gmxV2Ecosystem.live.registry.isHandler(core.gmxV2Ecosystem.gmxDepositHandlerV2.address),
        'isHandler check failing for gmx deposit handler'
      );
      assertHardhatInvariant(
        await core.gmxV2Ecosystem.live.registry.isHandler(core.gmxV2Ecosystem.gmxWithdrawalHandlerV2.address),
        'isHandler check failing for gmx withdrawal handler'
      );
      assertHardhatInvariant(
        await core.glvEcosystem.live.registry.isHandler(core.glvEcosystem.glvDepositHandler.address),
        'isHandler check failing for glv deposit handler'
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

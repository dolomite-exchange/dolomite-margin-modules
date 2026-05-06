import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { encodeSetGlobalOperator } from 'packages/deployment/src/utils/encoding/dolomite-margin-core-encoder-utils';
import { IAdminExpirePosition__factory } from 'packages/admin/src/types';

/**
 * This script encodes the following transactions:
 * - Deploys AdminExpirePosition
 * - Sets as global operator
 * - Sets gnosis safe as allowed caller
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const adminExpirePositionAddress = await deployContractAndSave(
    'AdminExpirePosition',
    [core.expiry.address, core.adminRegistry.address, core.dolomiteMargin.address],
    'AdminExpirePositionV1'
  );
  const adminExpirePosition = IAdminExpirePosition__factory.connect(
    adminExpirePositionAddress,
    core.hhUser1
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'adminRegistry',
      'grantPermission',
      [
        adminExpirePosition.interface.getSighash('expirePositions'),
        adminExpirePosition.address,
        core.gnosisSafe.address
      ]
    ),
    await encodeSetGlobalOperator(core, adminExpirePositionAddress, true)
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
          await core.dolomiteMargin.getIsGlobalOperator(adminExpirePosition.address),
          'AdminExpirePosition is not a global operator'
        );
      assertHardhatInvariant(
        await core.adminRegistry.hasPermission(
          adminExpirePosition.interface.getSighash('expirePositions'),
          adminExpirePosition.address,
          core.gnosisSafe.address,
        ),
        'Gnosis safe is not allowed to call expirePositions on AdminExpirePosition',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

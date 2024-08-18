import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the correct deposit / withdrawal vaults on the GMX V2 Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxDepositVault',
      [core.gmxV2Ecosystem.gmxDepositVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxWithdrawalVault',
      [core.gmxV2Ecosystem.gmxWithdrawalVault.address],
    ),
  ];

  return {
    core,
    upload: {
      transactions,
      chainId: network,
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        await core.gmxV2Ecosystem.live.registry.gmxDepositVault() === core.gmxV2Ecosystem.gmxDepositVault.address,
        'Invalid deposit vault',
      );
      assertHardhatInvariant(
        await core.gmxV2Ecosystem.live.registry.gmxWithdrawalVault() === core.gmxV2Ecosystem.gmxWithdrawalVault.address,
        'Invalid withdrawal vault',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

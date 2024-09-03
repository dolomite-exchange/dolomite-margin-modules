import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';

/**
 * This script encodes the following transactions:
 * - Increase the supply cap of gmUNI-USD to 900k units
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV8',
  );
  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV7',
  );
  const libraries = {
    IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress,
    GmxV2Library: gmxV2LibraryAddress,
  };

  const glpTokenVaultAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV2',
    [],
    'GLPIsolationModeTokenVaultV6',
    libraries,
  );

  const plvGlpTokenVaultAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV2',
    [],
    'GLPIsolationModeTokenVaultV6',
    libraries,
  );
  // TODO: deploy all of the new token vaults
  // TODO: Add each vault to the factory via `ownerSetUserVaultImplementation`

  const transactions = [];
  transactions.push();

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmUni)).value.eq(parseEther(`${900_000}`)),
        'Invalid gmUNI-USD max wei',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Withdraw all the leftover ETH in the wrappers/unwrappers
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  core.gmxV2Ecosystem.live.registry;
  const unwrappers = core.gmxV2Ecosystem.live.allGmMarkets.map(m => m.unwrapper);
  const wrappers = core.gmxV2Ecosystem.live.allGmMarkets.map(m => m.wrapper);

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < unwrappers.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { unwrapper: unwrappers[i] },
        'unwrapper',
        'ownerWithdrawETH',
        [core.gnosisSafeAddress],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { wrapper: wrappers[i] },
        'wrapper',
        'ownerWithdrawETH',
        [core.gnosisSafeAddress],
      ),
    );
  }

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
      for (let i = 0; i < unwrappers.length; i++) {
        assertHardhatInvariant(
          (await ethers.provider.getBalance(unwrappers[i].address)).eq(ZERO_BI),
          `Invalid unwrapper balance for ${unwrappers[i].address}`,
        );
        assertHardhatInvariant(
          (await ethers.provider.getBalance(wrappers[i].address)).eq(ZERO_BI),
          `Invalid wrapper balance for ${wrappers[i].address}`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

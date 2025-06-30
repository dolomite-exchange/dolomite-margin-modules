import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkInterestSetter, checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Fix pol-rUsd accounts, deploy new vault
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.dolo, 10_000_000),
    await encodeSetInterestSetter(
      core,
      core.marketIds.rUsd,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
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
      await checkSupplyCap(core, core.marketIds.dolo, parseEther(`${10_000_000}`));
      await checkInterestSetter(
        core,
        core.marketIds.rUsd,
        core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

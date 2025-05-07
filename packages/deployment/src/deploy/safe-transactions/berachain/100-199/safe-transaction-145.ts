import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkBorrowCap, checkInterestSetter, checkIsCollateralOnly } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Make iBERA borrowable, change the borrow cap, and the interest rate model
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetIsCollateralOnly(core, core.marketIds.iBera, false),
    await encodeSetInterestSetter(
      core,
      core.marketIds.iBera,
      core.interestSetters.linearStepFunction50L75U70OInterestSetter,
    ),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.iBera, 2_000_000),
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
      await checkIsCollateralOnly(core, core.marketIds.iBera, false);
      await checkInterestSetter(
        core,
        core.marketIds.iBera,
        core.interestSetters.linearStepFunction50L75U70OInterestSetter,
      );
      await checkBorrowCap(core, core.marketIds.iBera, parseEther(`${2_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);

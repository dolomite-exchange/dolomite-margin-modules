import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Update the interest rate model for all stables to use optimal rate of 14%
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const stablecoins = core.marketIds.stablecoinsWithUnifiedInterestRateModels;

  const transactions = [];
  for (let i = 0; i < stablecoins.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetInterestSetter',
        [stablecoins[i], core.interestSetters.linearStepFunction14L86U90OInterestSetter.address],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      const interestSetterAddress = core.interestSetters.linearStepFunction14L86U90OInterestSetter.address;
      for (let i = 0; i < stablecoins.length; i++) {
        assertHardhatInvariant(
          (await core.dolomiteMargin.getMarketInterestSetter(stablecoins[i])) === interestSetterAddress,
          `Invalid interest setter for ${stablecoins[i]}`
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

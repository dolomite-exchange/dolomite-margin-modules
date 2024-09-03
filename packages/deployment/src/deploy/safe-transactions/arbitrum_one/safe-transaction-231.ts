import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Removes the funky selector as instant on the factories
 * - Allows ownerSetUserVaultImplementation to be called instantly on the factory
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const stables = [
    core.marketIds.dai,
    core.marketIds.usdc,
    core.marketIds.nativeUsdc,
    core.marketIds.usdt,
    core.marketIds.mim,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < stables.length; i += 1) {
    const stable = stables[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetInterestSetter',
        [stable, core.interestSetters.linearStepFunction16L84U90OInterestSetter.address],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      for (let i = 0; i < stables.length; i += 1) {
        const stable = stables[i];
        assertHardhatInvariant(
          await core.dolomiteMargin.getMarketInterestSetter(stable)
          === core.interestSetters.linearStepFunction16L84U90OInterestSetter.address,
          `Invalid interest setter found for ${stable.toString()}`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

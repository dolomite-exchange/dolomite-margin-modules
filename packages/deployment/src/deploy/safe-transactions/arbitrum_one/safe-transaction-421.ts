import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the interest rate kink to be 10% APR for stables and 6% for yield-bearing stables
 * - Enables WBTC and ETH collateral/debt for all gm assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  const stablecoinMarketIds = core.marketIds.stablecoinsWithUnifiedInterestRateModels;
  for (const stablecoinMarketId of stablecoinMarketIds) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetInterestSetter',
        [stablecoinMarketId, core.interestSetters.linearStepFunction10L90U90OInterestSetter.address],
      ),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.wusdm, core.interestSetters.linearStepFunction6L94U90OInterestSetter.address],
    ),
  );

  const gmMarkets = core.gmxV2Ecosystem.gmTokens

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      const getInterestSetter = (o: BigNumberish) => core.dolomiteMargin.getMarketInterestSetter(o);

      for (const stablecoinMarketId of stablecoinMarketIds) {
        assertHardhatInvariant(
          core.interestSetters.linearStepFunction10L90U90OInterestSetter.address ===
            (await getInterestSetter(stablecoinMarketId)),
          `Invalid interest setter for ${stablecoinMarketId}`,
        );
      }

      assertHardhatInvariant(
        core.interestSetters.linearStepFunction10L90U90OInterestSetter.address ===
        (await getInterestSetter(core.marketIds.wusdm)),
        `Invalid interest setter for ${core.marketIds.wusdm}`,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

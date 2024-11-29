import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Change the interest rate model for WBTC, WETH, and stablecoins
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.wbtc, core.interestSetters.linearStepFunction6L94U80OInterestSetter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.weth, core.interestSetters.linearStepFunction8L92U80OInterestSetter.address],
    ),
  ];

  for (const marketId of core.marketIds.stablecoinsWithUnifiedInterestRateModels) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetInterestSetter',
        [marketId, core.interestSetters.linearStepFunction12L88U90OInterestSetter.address],
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
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.wbtc)) ===
          core.interestSetters.linearStepFunction6L94U80OInterestSetter.address,
        'Invalid WBTC interest setter',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)) ===
          core.interestSetters.linearStepFunction8L92U80OInterestSetter.address,
        'Invalid WETH interest setter',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

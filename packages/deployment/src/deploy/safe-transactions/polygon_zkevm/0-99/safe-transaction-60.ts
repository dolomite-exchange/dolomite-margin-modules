import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ILinearStepFunctionInterestSetter__factory } from 'packages/interest-setters/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the modular interest setter
 * - Loops through current dolomite markets, retrieves settings, and sets up the modular interest setter
 */
async function main(): Promise<DryRunOutput<Network.PolygonZkEvm>> {
  const network = await getAndCheckSpecificNetwork(Network.PolygonZkEvm);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  for (let i = 0; i < numMarkets.toNumber(); i++) {
    const market = await core.dolomiteMargin.getMarket(i);

    if (market.interestSetter === core.interestSetters.alwaysZeroInterestSetter.address) {
      continue;
    }

    const interestSetter = ILinearStepFunctionInterestSetter__factory.connect(market.interestSetter, core.hhUser1);
    const lowerOptimalPercent = await interestSetter.LOWER_OPTIMAL_PERCENT();
    const upperOptimalPercent = await interestSetter.UPPER_OPTIMAL_PERCENT();

    let optimalUtilization;
    try {
      optimalUtilization = await interestSetter.OPTIMAL_UTILIZATION();
    } catch (e) {
      optimalUtilization = parseEther('0.9'); // This interest setter hardcodes optimal utilization to 90%
    }

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.interestSetters,
        'modularInterestSetter',
        'ownerSetSettingsByToken',
        [market.token, lowerOptimalPercent, upperOptimalPercent, optimalUtilization],
      ),
      await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetInterestSetter', [
        i,
        core.interestSetters.modularInterestSetter.address,
      ]),
    );
  }

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
      for (let i = 0; i < numMarkets.toNumber(); i++) {
        const interestSetterAddress = await core.dolomiteMargin.getMarketInterestSetter(i);
        assertHardhatInvariant(
          interestSetterAddress === core.interestSetters.modularInterestSetter.address ||
            interestSetterAddress === core.interestSetters.alwaysZeroInterestSetter.address,
          `Invalid interest setter for market: ${i}`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

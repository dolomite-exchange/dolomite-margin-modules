import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the interest rate kink to be 12% APR for stables and 8% for yield-bearing stables
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
        [stablecoinMarketId, core.interestSetters.linearStepFunction12L88U90OInterestSetter.address],
      ),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.wusdm, core.interestSetters.linearStepFunction8L92U90OInterestSetter.address],
    ),
  );

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
          core.interestSetters.linearStepFunction12L88U90OInterestSetter.address ===
            (await getInterestSetter(stablecoinMarketId)),
          `Invalid interest setter for ${stablecoinMarketId}`,
        );
      }

      assertHardhatInvariant(
        core.interestSetters.linearStepFunction8L92U90OInterestSetter.address ===
          (await getInterestSetter(core.marketIds.wusdm)),
        `Invalid interest setter for ${core.marketIds.wusdm}`,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

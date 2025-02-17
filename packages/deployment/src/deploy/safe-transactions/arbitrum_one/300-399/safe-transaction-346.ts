import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates interest rate models for ezETH, rsETH, and weETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.ezEth, core.interestSetters.linearStepFunction16L84U80OInterestSetter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.rsEth, core.interestSetters.linearStepFunction16L84U80OInterestSetter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.weEth, core.interestSetters.linearStepFunction16L84U80OInterestSetter.address],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      const interestSetter = core.interestSetters.linearStepFunction16L84U80OInterestSetter;
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.ezEth)) === interestSetter.address,
        'Invalid interest setter for ezETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.rsEth)) === interestSetter.address,
        'Invalid interest setter for rsEth',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weEth)) === interestSetter.address,
        'Invalid interest setter for weEth',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the interest rate kinks and utilization levels for stables + major assets
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokens = core.tokens;
  const transactions: EncodedTransaction[] = [
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usd1,
      LowerPercentage._11,
      UpperPercentage._50,
      OptimalUtilizationRate._92,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdt,
      LowerPercentage._12,
      UpperPercentage._50,
      OptimalUtilizationRate._91,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdc,
      LowerPercentage._12,
      UpperPercentage._50,
      OptimalUtilizationRate._92,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.rUsd,
      LowerPercentage._10,
      UpperPercentage._30,
      OptimalUtilizationRate._91,
    ),

    await encodeSetModularInterestSetterParams(
      core,
      tokens.weth,
      LowerPercentage._3,
      UpperPercentage._40,
      OptimalUtilizationRate._91,
    ),

    await encodeSetModularInterestSetterParams(
      core,
      tokens.wbtc,
      LowerPercentage._4,
      UpperPercentage._60,
      OptimalUtilizationRate._90,
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

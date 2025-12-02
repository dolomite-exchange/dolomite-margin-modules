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
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokens = core.tokens;
  const transactions: EncodedTransaction[] = [
    await encodeSetModularInterestSetterParams(
      core,
      tokens.honey,
      LowerPercentage._7,
      UpperPercentage._50,
      OptimalUtilizationRate._91,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdc,
      LowerPercentage._7,
      UpperPercentage._50,
      OptimalUtilizationRate._91,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usde,
      LowerPercentage._7,
      UpperPercentage._50,
      OptimalUtilizationRate._90,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdt,
      LowerPercentage._7,
      UpperPercentage._50,
      OptimalUtilizationRate._90,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.byusd,
      LowerPercentage._7,
      UpperPercentage._60,
      OptimalUtilizationRate._90,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.rUsd,
      LowerPercentage._7,
      UpperPercentage._30,
      OptimalUtilizationRate._95,
    ),

    await encodeSetModularInterestSetterParams(
      core,
      tokens.wbera,
      LowerPercentage._45,
      UpperPercentage._100,
      OptimalUtilizationRate._75,
    ),

    await encodeSetModularInterestSetterParams(
      core,
      tokens.weth,
      LowerPercentage._3_9,
      UpperPercentage._60,
      OptimalUtilizationRate._90,
    ),

    await encodeSetModularInterestSetterParams(
      core,
      tokens.wbtc,
      LowerPercentage._4,
      UpperPercentage._80,
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

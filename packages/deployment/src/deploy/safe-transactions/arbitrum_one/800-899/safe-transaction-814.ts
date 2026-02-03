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
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the interest rate models for various assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.nativeUsdc, {
      lowerRate: LowerPercentage._10,
      upperRate: UpperPercentage._40,
    }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.usdc, {
      lowerRate: LowerPercentage._10,
      upperRate: UpperPercentage._40,
    }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.usdt, {
      lowerRate: LowerPercentage._10,
      upperRate: UpperPercentage._40,
    }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.link, {
      optimalUtilizationRate: OptimalUtilizationRate._80,
    }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.wbtc, { lowerRate: LowerPercentage._5 }),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.weth, { lowerRate: LowerPercentage._6 }),
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

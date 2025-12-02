import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { LowerPercentage, UpperPercentage } from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSupplyCapWithMagic,

} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Risk updates
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.byusd, 100_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.byusd, 95_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 95_000_000),
  ];

  for (let i = 0; i < core.marketIds.stablecoins.length; i += 1) {
    const marketId = core.marketIds.stablecoins[i];
    if (marketId === core.marketIds.byusd) {
      transactions.push(await encodeUpdateModularInterestSetterParams(core, marketId, {
        lowerRate: LowerPercentage._8,
        upperRate: UpperPercentage._50,
      }));
    } else {
      transactions.push(await encodeUpdateModularInterestSetterParams(core, marketId, { lowerRate: LowerPercentage._8 }));
    }
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

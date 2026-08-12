import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { OracleAggregatorV2__factory } from 'packages/oracles/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeUnpauseMarket } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Unpause markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const numMarkets = (await core.dolomiteMargin.getNumMarkets()).toNumber();
  const transactions: EncodedTransaction[] = [];
  for (let i = 12; i < numMarkets; i++) {
    if (i !== 15 && i !== 16 && i !== 17) {
      let oracle = core.oracleAggregatorV2;
      if (
        BigNumber.from(i).eq(core.marketIds.wbtc) ||
        BigNumber.from(i).eq(core.marketIds.lbtc) ||
        BigNumber.from(i).eq(core.marketIds.eBtc)
      ) {
        oracle = OracleAggregatorV2__factory.connect('0x622C8D85F0197efd2E4730ad5D78cf39C715B49D', core.hhUser1);
      }
      transactions.push(await encodeUnpauseMarket(core, i, oracle));
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
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.dolo);
      await printPriceForVisualCheck(core, core.tokens.henlo);
      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, core.tokens.diBgt);
      await printPriceForVisualCheck(core, core.tokens.wgBera);
      await printPriceForVisualCheck(core, core.tokens.kdk);
    },
  };
}

doDryRunAndCheckDeployment(main);

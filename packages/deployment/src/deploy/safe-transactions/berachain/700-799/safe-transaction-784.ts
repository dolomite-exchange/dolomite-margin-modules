import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodePauseMarket } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps for some assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  const markets = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; i < markets.toNumber(); i++) {
    const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(i);
    const oracles = await core.oracleAggregatorV2.getOraclesByToken(tokenAddress);
    oracles.map(o => ({
      oracles: o.oracle,
      tokenPair: ADDRESS_ZERO,
      weight: o.weight,
    }));
    if (oracles.some(o => o.tokenPair !== ADDRESS_ZERO)) {
      transactions.push(await prettyPrintEncodedDataWithTypeSafety(
        core,
        { agg: core.oracleAggregatorV2 },
        'agg',
        'ownerInsertOrUpdateToken',
        []
      ));
    }
    transactions.push(await encodePauseMarket(core, i));
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
    },
  };
}

doDryRunAndCheckDeployment(main);

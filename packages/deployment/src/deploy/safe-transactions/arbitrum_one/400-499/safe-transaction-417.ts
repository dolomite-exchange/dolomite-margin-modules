import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets decimals on the (fake) Doge token to 8 on the oracle aggregator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dogeToken = core.gmxV2Ecosystem.gmTokens.dogeUsd.indexToken;

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: dogeToken.address,
        decimals: 8,
        oracleInfos: [
          {
            oracle: (await core.oracleAggregatorV2.getOraclesByToken(dogeToken.address))[0].oracle,
            weight: 100,
            tokenPair: ADDRESS_ZERO,
          },
        ],
      },
    ]),
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
      const dogePrice = await core.oracleAggregatorV2.getPrice(dogeToken.address);
      console.log('\tPrice:', dogePrice.value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);

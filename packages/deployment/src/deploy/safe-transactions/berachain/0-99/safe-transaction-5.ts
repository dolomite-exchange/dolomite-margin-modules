import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Changes the oracles for a few markets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const market4 = await core.dolomiteMargin.getMarketTokenAddress(4);
  const market5 = await core.dolomiteMargin.getMarketTokenAddress(5);
  const market6 = await core.dolomiteMargin.getMarketTokenAddress(6);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: market4,
        oracleInfos: [{ oracle: '0xd55AFc5eE5fFdAd3d44829b22E2C2B10a484D33e', tokenPair: ADDRESS_ZERO, weight: 100 }],
        decimals: 8,
      },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: market5,
        oracleInfos: [{ oracle: '0xd55AFc5eE5fFdAd3d44829b22E2C2B10a484D33e', tokenPair: ADDRESS_ZERO, weight: 100 }],
        decimals: 18,
      },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        token: market6,
        oracleInfos: [{ oracle: '0xd55AFc5eE5fFdAd3d44829b22E2C2B10a484D33e', tokenPair: ADDRESS_ZERO, weight: 100 }],
        decimals: 18,
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

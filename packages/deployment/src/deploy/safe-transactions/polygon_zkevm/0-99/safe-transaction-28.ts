import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds the POL market
 */
async function main(): Promise<DryRunOutput<Network.PolygonZkEvm>> {
  const network = await getAndCheckSpecificNetwork(Network.PolygonZkEvm);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await prettyPrintEncodeInsertChainlinkOracleV3(core, core.tokens.pol),
  );
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
      addExecuteImmediatelyTransactions: true,
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      const marketId = core.marketIds.pol;
      assertHardhatInvariant(
        (await core.chainlinkPriceOracleV3.getAggregatorByToken(core.tokens.pol.address)) ===
          CHAINLINK_PRICE_AGGREGATORS_MAP[Network.PolygonZkEvm][core.tokens.pol.address]?.aggregatorAddress,
        'Invalid Chainlink price aggregator for POL',
      );

      console.log('\tPrice: ', (await core.dolomiteMargin.getMarketPrice(marketId)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);

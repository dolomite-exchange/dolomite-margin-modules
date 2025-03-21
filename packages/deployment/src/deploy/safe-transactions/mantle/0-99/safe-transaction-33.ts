import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds the FBTC markets
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  const fbtcMarketId = numMarkets.add(incrementor++);

  transactions.push(
    ...await encodeInsertChronicleOracleV3(
      core,
      core.tokens.fbtc,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.fbtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      `${50_00000000}`,
      `${30_00000000}`,
      false,
    ),
  );
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
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(14), 'Invalid number of markets');

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.fbtc)) === core.tokens.fbtc.address,
        'Invalid FBTC market ID',
      );
      assertHardhatInvariant(BigNumber.from(core.marketIds.fbtc).eq(fbtcMarketId), 'Invalid FBTC market ID');
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.fbtc)) === core.oracleAggregatorV2.address,
        'Invalid oracle for FBTC',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.fbtc)) ===
          core.interestSetters.linearStepFunction8L92U90OInterestSetter.address,
        'Invalid interest setter FBTC',
      );
      console.log('\tPrice for FBTC', (await core.dolomiteMargin.getMarketPrice(core.marketIds.fbtc)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);

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
  prettyPrintEncodeInsertChronicleOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

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
  const cmEthMarketId = numMarkets.add(incrementor++);

  transactions.push(
    ...(await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.cmEth)),
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.cmEth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${15_000}`),
      parseEther(`${10_000}`),
      false,
    )),
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
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(15), 'Invalid number of markets');

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.cmEth)) === core.tokens.cmEth.address,
        'Invalid cmETH market ID',
      );
      assertHardhatInvariant(BigNumber.from(core.marketIds.cmEth).eq(cmEthMarketId), 'Invalid cmETH market ID');
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.cmEth)) === core.oracleAggregatorV2.address,
        'Invalid oracle for cmETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.cmEth)) ===
          core.interestSetters.linearStepFunction8L92U90OInterestSetter.address,
        'Invalid interest setter cmETH',
      );
      console.log(
        '\tPrice for cmETH',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.cmEth)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

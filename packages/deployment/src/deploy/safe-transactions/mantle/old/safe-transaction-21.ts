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
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds the USDY markets
 * - Sets up the ptUSDY ecosystem
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
  const usdyMarketId = numMarkets.add(incrementor++);

  transactions.push(
    ...await encodeAddMarket(
      core,
      core.tokens.usdy,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction10L90U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${25_000_000}`),
      parseEther(`${20_000_000}`),
      false,
    ),
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
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(9), 'Invalid number of markets');

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdy)) === core.tokens.usdy.address,
        'Invalid USDY market ID',
      );
      assertHardhatInvariant(BigNumber.from(core.marketIds.usdy).eq(usdyMarketId), 'Invalid USDY market ID');
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.usdy)) === core.oracleAggregatorV2.address,
        'Invalid oracle for USDY',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usdy)) ===
          core.interestSetters.linearStepFunction10L90U90OInterestSetter.address,
        'Invalid interest setter USDY',
      );
      console.log('\tPrice for USDY', (await core.dolomiteMargin.getMarketPrice(core.marketIds.usdy)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);

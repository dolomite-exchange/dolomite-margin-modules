import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';

/**
 * This script encodes the following transactions:
 * - Adds USDe to the Chainlink Price Oracle and Oracle Aggregator
 * - Adds the USDe markets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const marketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(core, core.tokens.usde)),
  )
  transactions.push(
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usde,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter, // @follow-up Not sure what you want to put for these values
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${15_000_000}`),
      parseEther(`${10_000_000}`),
      false,
  )));

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
      assertHardhatInvariant(
        await core.chainlinkPriceOracleV3.getAggregatorByToken(core.tokens.usde.address) 
          == (CHAINLINK_PRICE_AGGREGATORS_MAP[network][core.tokens.usde.address]!.aggregatorAddress),
        'Chainlink aggregator not set'
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.usde.address)).eq(marketId),
        'Invalid market id'
      );

      // @follow-up Price is coming to $1 exactly on Arbitrum but not Ethereum mainnet. Seems fishy
      console.log(
        '\t Price for usde',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usde.address)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

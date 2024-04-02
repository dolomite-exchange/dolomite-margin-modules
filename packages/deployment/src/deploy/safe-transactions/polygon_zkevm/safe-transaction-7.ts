import { CHAINLINK_PRICE_AGGREGATORS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracle,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the interest setter on WETH
 * - Sets the price oracle on WETH
 * - Adds the USDC, DAI, LINK, and MATIC markets
 */
async function main(): Promise<DryRunOutput<Network.PolygonZkEvm>> {
  const network = await getAndCheckSpecificNetwork(Network.PolygonZkEvm);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.usdc,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdc,
      core.chainlinkPriceOracleOld,
      core.interestSetters.linearStepFunction10L90U95OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
  );
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getNumMarkets()).eq(8),
        'Invalid number of markets',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdc)) === core.tokens.usdc.address,
        'Invalid collateral token for USDC market ID',
      );
      assertHardhatInvariant(
        BigNumber.from(core.marketIds.usdc).eq(7),
        'Invalid collateral token for USDC market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.usdc)) === core.chainlinkPriceOracleOld.address,
        'Invalid Chainlink price aggregator for USDC',
      );
      assertHardhatInvariant(
        (await core.chainlinkPriceOracleOld.getAggregatorByToken(core.tokens.usdc.address))
        === CHAINLINK_PRICE_AGGREGATORS_MAP[Network.PolygonZkEvm][core.tokens.usdc.address],
        'Invalid Chainlink price aggregator for USDC',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

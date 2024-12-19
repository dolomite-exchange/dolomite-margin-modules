import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { parseUsdt, parseBtc } from 'packages/base/src/utils/math-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

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
      core.tokens.wbtc,
    ),
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.usdt,
    ),
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.matic,
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteRegistry: core.dolomiteRegistry },
      'dolomiteRegistry',
      'ownerSetChainlinkPriceOracle',
      [core.chainlinkPriceOracleV1.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.weth, core.chainlinkPriceOracleV1.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.weth, core.interestSetters.linearStepFunction14L86U90OInterestSetter.address],
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.dai,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction10L90U95OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${250_000}`),
      parseEther(`${200_000}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdc,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction10L90U95OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.link,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${5_000}`),
      parseEther(`${4_000}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.wbtc,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseBtc(`${5_000}`),
      parseBtc(`${4_000}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdt,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction10L90U95OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdt(`${1_000_000}`),
      parseUsdt(`${900_000}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.matic,
      core.chainlinkPriceOracleV1,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${10_000_000}`),
      parseEther(`${9_000_000}`),
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
        await core.dolomiteRegistry.chainlinkPriceOracle() === core.chainlinkPriceOracleV1.address,
        'Invalid chainlink price oracle on registry',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth) === core.chainlinkPriceOracleV1.address,
        'Invalid chainlink price oracle for WETH',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)
        === core.interestSetters.linearStepFunction14L86U90OInterestSetter.address,
        'Invalid chainlink price oracle for WETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getNumMarkets()).eq(7),
        'Invalid chainlink price oracle on registry',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.weth)) === core.tokens.weth.address,
        'Invalid collateral token on market 0',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.dai)) === core.tokens.dai.address,
        'Invalid collateral token on market 1',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdc)) === core.tokens.usdc.address,
        'Invalid collateral token on market 2',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.link)) === core.tokens.link.address,
        'Invalid collateral token on market 3',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wbtc)) === core.tokens.wbtc.address,
        'Invalid collateral token on market 4',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdt)) === core.tokens.usdt.address,
        'Invalid collateral token on market 5',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.matic)) === core.tokens.matic.address,
        'Invalid collateral token on market 6',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

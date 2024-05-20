import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { parseWbtc } from '@dolomite-exchange/modules-base/src/utils/math-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the interest setter on WETH
 * - Sets the price oracle on WETH
 * - Adds the USDC, DAI, LINK, and MATIC markets
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.weth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.wmnt,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty.Base,
      parseEther(`${25_00_000}`),
      parseEther(`${20_00_000}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84UInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.wbtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92UInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._9,
      parseWbtc(`${100}`),
      parseWbtc(`${90}`),
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usdt,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84UInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    // We don't have an oracle for this yet!
    // ...await prettyPrintEncodeAddMarket(
    //   core,
    //   core.tokens.usdy,
    //   core.oracleAggregatorV2,
    //   core.interestSetters.linearStepFunction16L84UInterestSetter,
    //   TargetCollateralization.Base,
    //   TargetLiquidationPenalty.Base,
    //   parseEther(`${10_000_000}`),
    //   parseEther(`${9_000_000}`),
    //   false,
    // ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.meth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { proxy: core.depositWithdrawalProxy },
      'proxy',
      'initializeETHMarket',
      [core.tokens.wmnt.address],
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
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth) === core.oracleAggregatorV2.address,
        'Invalid oracle for WETH',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)
        === core.interestSetters.linearStepFunction14L86UInterestSetter.address,
        'Invalid interest setter WETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getNumMarkets()).eq(6),
        'Invalid number of markets',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.weth)) === core.tokens.weth.address,
        'Invalid weth for market 0',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wmnt)) === core.tokens.wmnt.address,
        'Invalid wmnt for market 1',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdc)) === core.tokens.usdc.address,
        'Invalid usdc for market 2',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wbtc)) === core.tokens.wbtc.address,
        'Invalid wbtc for market 3',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdt)) === core.tokens.usdt.address,
        'Invalid usdt for market 4',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.meth)) === core.tokens.meth.address,
        'Invalid usdt for market 5',
      );

      console.log(
        '\t Price for weth',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value.toString(),
      );
      console.log(
        '\t Price for wmnt',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.wmnt)).value.toString(),
      );
      console.log(
        '\t Price for usdc',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc)).value.toString(),
      );
      console.log(
        '\t Price for wbtc',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.wbtc)).value.toString(),
      );
      console.log(
        '\t Price for usdt',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.usdt)).value.toString(),
      );
      console.log(
        '\t Price for meth',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.meth)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

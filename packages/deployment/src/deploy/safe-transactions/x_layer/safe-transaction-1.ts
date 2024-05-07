import { IERC20Metadata__factory } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceAggregatorByToken } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { parseUsdt, parseWbtc } from '@dolomite-exchange/modules-base/src/utils/math-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getChainlinkPriceOracleV3ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { OkxPriceOracleV3__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
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
async function main(): Promise<DryRunOutput<Network.XLayer>> {
  const network = await getAndCheckSpecificNetwork(Network.XLayer);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokens = [
    core.tokens.weth,
    core.tokens.wokb,
    core.tokens.usdc,
    core.tokens.wbtc,
    core.tokens.usdt,
  ];
  const okxPriceOracleV3Address = await deployContractAndSave(
    'OkxPriceOracleV3',
    getChainlinkPriceOracleV3ConstructorParams(
      tokens,
      tokens.map(t => getChainlinkPriceAggregatorByToken(core, t)),
      tokens.map(() => false),
      core.dolomiteRegistry,
      core.dolomiteMargin,
    ),
  );
  const okxPriceOracleV3 = OkxPriceOracleV3__factory.connect(okxPriceOracleV3Address, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.weth.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.weth.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: okxPriceOracleV3.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.wokb.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.wokb.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: okxPriceOracleV3.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.usdc.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.usdc.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: okxPriceOracleV3.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.wbtc.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.wbtc.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: okxPriceOracleV3.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.usdt.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.usdt.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: okxPriceOracleV3.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
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
      core.tokens.wokb,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty.Base,
      parseEther(`${600_000}`),
      parseEther(`${500_000}`),
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
      core.interestSetters.linearStepFunction14L86UInterestSetter,
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
      parseUsdt(`${10_000_000}`),
      parseUsdt(`${9_000_000}`),
      false,
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { proxy: core.depositWithdrawalProxy },
      'proxy',
      'initializeETHMarket',
      [core.tokens.wokb.address],
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
        await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth) === core.oracleAggregatorV2.address,
        'Invalid oracle for WETH',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)
        === core.interestSetters.linearStepFunction14L86UInterestSetter.address,
        'Invalid interest setter WETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getNumMarkets()).eq(5),
        'Invalid number of markets',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.weth)) === core.tokens.weth.address,
        'Invalid weth for market 0',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wokb)) === core.tokens.wokb.address,
        'Invalid wokb for market 1',
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

      console.log(
        '\t Price for weth',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value.toString(),
      );
      console.log(
        '\t Price for wokb',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.wokb)).value.toString(),
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
    },
  };
}

doDryRunAndCheckDeployment(main);

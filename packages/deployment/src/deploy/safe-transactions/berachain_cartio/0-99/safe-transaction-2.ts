import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from 'packages/base/src/types';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { CoreProtocolBerachainCartio } from 'packages/base/test/utils/core-protocols/core-protocol-berachain-cartio';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

async function encodeTestOracle(
  token: IERC20,
  price: BigNumberish,
  core: CoreProtocolBerachainCartio,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracle__factory.connect(
    ModuleDeployments.TestPriceOracle[core.network].address,
    core.hhUser1,
  );

  return [
    await prettyPrintEncodedDataWithTypeSafety(core, { testPriceOracle }, 'testPriceOracle', 'setPrice', [
      token.address,
      price,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: testPriceOracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

/**
 * This script encodes the following transactions:
 * - Adds the WETH, BERA, and HONEY markets
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeTestOracle(core.tokens.weth, '4800000000000000000000', core)),
    ...(await encodeTestOracle(core.tokens.wbera, '6420000000000000000', core)),
    ...(await encodeTestOracle(core.tokens.usdc, '1000000000000000000000000000000', core)),
    ...(await encodeTestOracle(core.tokens.honey, '1000000000000000000', core)),
    ...(await encodeTestOracle(core.tokens.wbtc, '999990000000000000000000000000000', core)),
    ...(await encodeTestOracle(core.tokens.usdt, '1000000000000000000000000000000', core)),
    ...(await encodeAddMarket(
      core,
      core.tokens.weth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.wbera,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.usdc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.honey,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.wbtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.usdt,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.depositWithdrawalProxy.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { proxy: core.depositWithdrawalProxy },
      'proxy',
      'initializePayableMarket',
      [core.tokens.wbera.address],
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
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(6), 'Invalid number of markets');
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.weth)) === core.tokens.weth.address,
        'Invalid weth for market 0',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wbera)) === core.tokens.wbera.address,
        'Invalid wmnt for market 1',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdc)) === core.tokens.usdc.address,
        'Invalid usdc for market 2',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.honey)) === core.tokens.honey.address,
        'Invalid wbtc for market 3',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.wbtc)) === core.tokens.wbtc.address,
        'Invalid wbtc for market 4',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usdt)) === core.tokens.usdt.address,
        'Invalid usdt for market 5',
      );

      console.log(
        '\t Price for weth',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value.toString(),
      );
      console.log(
        '\t Price for wbera',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.wbera)).value.toString(),
      );
      console.log(
        '\t Price for usdc',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc)).value.toString(),
      );
      console.log(
        '\t Price for honey',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.honey)).value.toString(),
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

import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from 'packages/base/src/types';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

async function encodeTestOracle(
  token: IERC20,
  price: BigNumberish,
  core: CoreProtocolBerachain,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracle__factory.connect(
    ModuleDeployments.TestPriceOracle['80084'].address,
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
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  if (network === '80084') {
    console.log('\tSetting test prices for Bera Bartio...');
    transactions.push(
      ...(await encodeTestOracle(core.tokens.wbera, '6810000000000000000', core)),
      ...(await encodeTestOracle(core.tokens.usdc, '1000000000000000000000000000000', core)),
      ...(await encodeTestOracle(core.tokens.honey, '1000000000000000000', core)),
    );
  }

  transactions.push(
    ...(await prettyPrintEncodeAddMarket(
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
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.wbera,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
    ...(await prettyPrintEncodeAddMarket(
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
    ...(await prettyPrintEncodeAddMarket(
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
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.weth)) === core.oracleAggregatorV2.address,
        'Invalid oracle for WETH',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.weth)) ===
          core.interestSetters.linearStepFunction8L92U90OInterestSetter.address,
        'Invalid interest setter WETH',
      );
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(4), 'Invalid number of markets');
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
    },
  };
}

doDryRunAndCheckDeployment(main);

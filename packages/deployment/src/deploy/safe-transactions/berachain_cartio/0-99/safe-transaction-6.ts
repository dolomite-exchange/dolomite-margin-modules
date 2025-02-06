import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20, TestPriceOracle__factory } from 'packages/base/src/types';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { IERC20Metadata__factory } from '../../../../../../base/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { CoreProtocolBerachainCartio } from '../../../../../../base/test/utils/core-protocols/core-protocol-berachain-cartio';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
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

async function encodeListing(
  core: CoreProtocolBerachainCartio,
  token: IERC20,
  price: BigNumberish,
): Promise<EncodedTransaction[]> {
  return [
    ...(await encodeTestOracle(token, price, core)),
    ...(await prettyPrintEncodeAddMarket(
      core,
      token,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    )),
  ];
}

/**
 * This script encodes the following transactions:
 * - Lists beraETH, NECT, pumpBTC, stBTC, STONE, ylBTCLST, ylFBTC, ylPumpBTC, ylstETH, yluniBTC
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeListing(core, core.tokens.beraETH, '5000000000000000000000')),
    ...(await encodeListing(core, core.tokens.nect, '1000000000000000000')),
    ...(await encodeListing(core, core.tokens.pumpBtc, '1000000000000000000000000000000000')),
    ...(await encodeListing(core, core.tokens.stBtc, '1000000000000000000000000000000000')),
    ...(await encodeListing(core, core.tokens.stone, '5000000000000000000000')),
    ...(await encodeListing(core, core.tokens.ylBtcLst, '1000000000000000000000000000000000')),
    ...(await encodeListing(core, core.tokens.ylFbtc, '1000000000000000000000000000000000')),
    ...(await encodeListing(core, core.tokens.ylPumpBtc, '1000000000000000000000000000000000')),
    ...(await encodeListing(core, core.tokens.ylStEth, '5000000000000000000000')),
    ...(await encodeListing(core, core.tokens.ylUniBtc, '1000000000000000000000000000000000')),
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
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.beraETH)) === core.tokens.beraETH.address,
        'Invalid beraETH token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.nect)) === core.tokens.nect.address,
        'Invalid nect token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.pumpBtc)) === core.tokens.pumpBtc.address,
        'Invalid pumpBtc token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.stBtc)) === core.tokens.stBtc.address,
        'Invalid stBtc token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.stone)) === core.tokens.stone.address,
        'Invalid stone token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.ylBtcLst)) === core.tokens.ylBtcLst.address,
        'Invalid ylBtcLst token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.ylFbtc)) === core.tokens.ylFbtc.address,
        'Invalid ylFbtc token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.ylPumpBtc)) === core.tokens.ylPumpBtc.address,
        'Invalid ylPumpBtc token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.ylStEth)) === core.tokens.ylStEth.address,
        'Invalid ylStEth token',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.ylUniBtc)) === core.tokens.ylUniBtc.address,
        'Invalid ylUniBtc token',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

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
 * - Lists STONE (V2); fixes old L0 V1 issue and updates their token to V2
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...(await encodeListing(core, core.tokens.stone, '5000000000000000000000')),
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
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.stone)) === core.tokens.stone.address,
        'Invalid stone token',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

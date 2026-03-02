import { parseEther } from 'ethers/lib/utils';
import { IERC20Metadata__factory } from '../../../../../../base/src/types';
import { OptimalUtilizationRate, UpperPercentage } from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetEarningsRateOverride } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Set new risk caps
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'constantPriceOracle', 'ownerSetTokenPrice', [
      core.tokens.usda.address,
      parseEther(`${0.983877}`),
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'constantPriceOracle', 'ownerSetTokenPrice', [
      core.tokens.sUsda.address,
      parseEther(`${1.0862}`),
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'constantPriceOracle', 'ownerSetTokenPrice', [
      core.tokens.beraEth.address,
      parseEther(`${1.04755582}`),
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        oracleInfos: [
          {
            oracle: core.constantPriceOracle.address,
            tokenPair: core.tokens.weth.address,
            weight: 100,
          },
        ],
        decimals: await IERC20Metadata__factory.connect(core.tokens.beraEth.address, core.hhUser1).decimals(),
        token: core.tokens.beraEth.address,
      },
    ]),

    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        oracleInfos: [
          {
            oracle: core.constantPriceOracle.address,
            tokenPair: ADDRESS_ZERO,
            weight: 100,
          },
        ],
        decimals: await IERC20Metadata__factory.connect(core.tokens.sUsda.address, core.hhUser1).decimals(),
        token: core.tokens.sUsda.address,
      },
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'oracleAggregatorV2', 'ownerInsertOrUpdateToken', [
      {
        oracleInfos: [
          {
            oracle: core.constantPriceOracle.address,
            tokenPair: ADDRESS_ZERO,
            weight: 100,
          },
        ],
        decimals: await IERC20Metadata__factory.connect(core.tokens.usda.address, core.hhUser1).decimals(),
        token: core.tokens.usda.address,
      },
    ]),

    await encodeUpdateModularInterestSetterParams(core, core.marketIds.rUsd, {
      upperRate: UpperPercentage._50,
      optimalUtilizationRate: OptimalUtilizationRate._90,
    }),
    await encodeSetEarningsRateOverride(core, core.marketIds.rUsd, ZERO_BI),
  ];

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
      await printPriceForVisualCheck(core, core.tokens.beraEth);
      await printPriceForVisualCheck(core, core.tokens.usda);
      await printPriceForVisualCheck(core, core.tokens.sUsda);
    },
  };
}

doDryRunAndCheckDeployment(main);

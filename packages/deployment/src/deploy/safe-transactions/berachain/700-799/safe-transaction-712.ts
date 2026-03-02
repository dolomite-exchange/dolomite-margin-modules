import { parseEther } from 'ethers/lib/utils';
import { IERC20Metadata__factory } from '../../../../../../base/src/types';
import { OptimalUtilizationRate, UpperPercentage } from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetEarningsRateOverride, encodeSetIsCollateralOnly, encodeSetSupplyCap } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
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
      core.tokens.nect.address,
      parseEther(`${0.999679}`),
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
        decimals: await IERC20Metadata__factory.connect(core.tokens.nect.address, core.hhUser1).decimals(),
        token: core.tokens.nect.address,
      },
    ]),

    await encodeSetSupplyCap(core, core.marketIds.nect, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.nect, true),
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
      await printPriceForVisualCheck(core, core.tokens.nect);
    },
  };
}

doDryRunAndCheckDeployment(main);

import { parseEther } from 'ethers/lib/utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Makes stBTC not borrowable
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    ...(await encodeAddMarket(
      core,
      core.tokens.sUsda,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${5_000_000}`),
      ZERO_BI,
      true,
    )),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      await printPriceForVisualCheck(core, core.tokens.sUsda);
    },
  };
}

doDryRunAndCheckDeployment(main);

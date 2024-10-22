import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeInsertChronicleOracleV3,
  prettyPrintEncodeInsertRedstoneOracleV3,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the ETH market's oracle to Redstone
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await prettyPrintEncodeInsertRedstoneOracleV3(core, core.tokens.weth)),
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
      console.log(
        '\t Price for weth',
        (await core.oracleAggregatorV2.getPrice(core.tokens.weth.address)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

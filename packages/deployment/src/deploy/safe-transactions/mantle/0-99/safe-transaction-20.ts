import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the ETH market's oracle to Chronicle
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await prettyPrintEncodeInsertChronicleOracleV3(core, core.tokens.weth),
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

import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the oracle for USDe, USDT, USDY, ETH, and MNT to Chronicle
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await encodeInsertChronicleOracleV3(core, core.tokens.usde),
    ...await encodeInsertChronicleOracleV3(core, core.tokens.usdt),
    ...await encodeInsertChronicleOracleV3(core, core.tokens.usdy),
    ...await encodeInsertChronicleOracleV3(core, core.tokens.weth),
    ...await encodeInsertChronicleOracleV3(core, core.tokens.wmnt),
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
        '\t Price for usde',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usde.address)).value.toString(),
      );
      console.log(
        '\t Price for usdt',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usdt.address)).value.toString(),
      );
      console.log(
        '\t Price for usdy',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usdy.address)).value.toString(),
      );
      console.log(
        '\t Price for weth',
        (await core.oracleAggregatorV2.getPrice(core.tokens.weth.address)).value.toString(),
      );
      console.log(
        '\t Price for wmnt',
        (await core.oracleAggregatorV2.getPrice(core.tokens.wmnt.address)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

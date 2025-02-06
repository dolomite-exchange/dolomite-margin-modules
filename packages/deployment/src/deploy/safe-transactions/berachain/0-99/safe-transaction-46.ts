import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeInsertChronicleOracleV3,
  encodeInsertRedstoneOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Encodes placeholder oracles for a few markets that will come after mainnet
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.nect)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.stonebtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.uniBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.beraEth)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.ylStEth)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.fbtc)),
    ...(await encodeInsertChronicleOracleV3(core, core.tokens.ylBtcLst)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.stBtc)),
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
      await printPriceForVisualCheck(core, core.tokens.nect);
      await printPriceForVisualCheck(core, core.tokens.stonebtc);
      await printPriceForVisualCheck(core, core.tokens.uniBtc);
      await printPriceForVisualCheck(core, core.tokens.beraEth);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
      await printPriceForVisualCheck(core, core.tokens.fbtc);
      await printPriceForVisualCheck(core, core.tokens.ylBtcLst);
      await printPriceForVisualCheck(core, core.tokens.stBtc);
    },
  };
}

doDryRunAndCheckDeployment(main);

import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertRedstoneOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Switch to Redstone for all assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.wbera)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.usdc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.honey)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.wbtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.usdt)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.stonebtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.stone)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.uniBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ylBtcLst)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ylPumpBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ylStEth)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.pumpBtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.rsEth)),
    // Missing: rUSD, srUSD, and OHM
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
      await printPriceForVisualCheck(core, core.tokens.wbera);
      await printPriceForVisualCheck(core, core.tokens.usdc);
      await printPriceForVisualCheck(core, core.tokens.honey);
      await printPriceForVisualCheck(core, core.tokens.wbtc);
      await printPriceForVisualCheck(core, core.tokens.usdt);
      await printPriceForVisualCheck(core, core.tokens.stonebtc);
      await printPriceForVisualCheck(core, core.tokens.stone);
      await printPriceForVisualCheck(core, core.tokens.uniBtc);
      await printPriceForVisualCheck(core, core.tokens.ylBtcLst);
      await printPriceForVisualCheck(core, core.tokens.ylPumpBtc);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
      await printPriceForVisualCheck(core, core.tokens.pumpBtc);
      await printPriceForVisualCheck(core, core.tokens.rsEth);
    },
  };
}

doDryRunAndCheckDeployment(main);

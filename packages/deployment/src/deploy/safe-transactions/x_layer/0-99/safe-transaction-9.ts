import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Sets the price oracle on USDC, USDT, WBTC, WETH, and WOKB to use Chainlink
 */
async function main(): Promise<DryRunOutput<Network.XLayer>> {
  const network = await getAndCheckSpecificNetwork(Network.XLayer);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.usdc)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.usdt)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.wbtc)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.weth)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.wokb)),
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
      await printPriceForVisualCheck(core, core.tokens.usdc);
      await printPriceForVisualCheck(core, core.tokens.usdt);
      await printPriceForVisualCheck(core, core.tokens.wbtc);
      await printPriceForVisualCheck(core, core.tokens.weth);
      await printPriceForVisualCheck(core, core.tokens.wokb);
    },
  };
}

doDryRunAndCheckDeployment(main);

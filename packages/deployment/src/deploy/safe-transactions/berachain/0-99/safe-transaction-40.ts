import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployDolomiteErc4626Token, EncodedTransaction } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsGlobalOperator, encodeSetGlobalOperator } from '../utils';

const IS_GLOBAL_OPERATOR = true;

/**
 * This script encodes the following transactions:
 * - Creates dToken markets for each listed asset for Boyco
 * - Sets each dToken as a global operator
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const eBtc = await deployDolomiteErc4626Token(core, 'EBtc', core.marketIds.eBtc);
  const weEth = await deployDolomiteErc4626Token(core, 'WeEth', core.marketIds.weEth);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetGlobalOperator(core, eBtc, IS_GLOBAL_OPERATOR),
    await encodeSetGlobalOperator(core, weEth, IS_GLOBAL_OPERATOR),
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
      await checkIsGlobalOperator(core, eBtc);
      await checkIsGlobalOperator(core, weEth);
    },
  };
}

doDryRunAndCheckDeployment(main);

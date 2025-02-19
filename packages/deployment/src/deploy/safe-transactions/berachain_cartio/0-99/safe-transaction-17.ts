import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  EncodedTransaction,
  prettyPrintSetGlobalOperator,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Creates dTokens for each listed market
 * - Sets each dToken as a global operator
 */
async function main(): Promise<DryRunOutput<Network.BerachainCartio>> {
  const network = await getAndCheckSpecificNetwork(Network.BerachainCartio);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const rsEth = await deployDolomiteErc4626Token(core, 'RsEth', core.marketIds.rsEth);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintSetGlobalOperator(core, rsEth, true),
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
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(rsEth.address),
        'rsEth is not a global operator',
      );
      assertHardhatInvariant(
        await rsEth.asset() === core.tokens.rsEth.address,
        'Invalid market ID',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

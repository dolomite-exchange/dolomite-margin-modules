import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployDolomiteErc4626Token } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
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

  const solvBtc = await deployDolomiteErc4626Token(core, 'SolvBtc', core.marketIds.solvBtc);
  const solvBtcBbn = await deployDolomiteErc4626Token(core, 'SolvBtcBbn', core.marketIds.solvBtcBbn);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetGlobalOperator(core, solvBtc, true),
    await encodeSetGlobalOperator(core, solvBtcBbn, true),
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
        await core.dolomiteMargin.getIsGlobalOperator(solvBtc.address),
        'solvBtc is not a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(solvBtcBbn.address),
        'solvBtcBbn is not a global operator',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

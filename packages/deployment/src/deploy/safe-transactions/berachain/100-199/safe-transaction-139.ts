import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';

/**
 * This script encodes the following transactions:
 * - Transfers wBERA to the gnosis safe
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dWbera = core.dolomiteTokens.wbera;
  const balancePar = (await dWbera.balanceOf(core.governanceAddress)).sub(ONE_ETH_BI);
  const balanceWei = await dWbera.convertToAssets(balancePar);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { router: core.depositWithdrawalRouter },
      'router',
      'withdrawPar',
      [0, 0, core.marketIds.wbera, balancePar, BalanceCheckFlag.Both],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { wbera: core.tokens.wbera },
      'wbera',
      'transfer',
      [core.gnosisSafeAddress, balanceWei],
    ),
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
      await expectWalletBalance(core.gnosisSafeAddress, core.tokens.wbera, balanceWei);
    },
  };
}

doDryRunAndCheckDeployment(main);

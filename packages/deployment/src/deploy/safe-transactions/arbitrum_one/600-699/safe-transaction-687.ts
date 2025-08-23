import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { FinalSettlementViaInternalSwapProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { ModuleDeployments } from '../../../../utils';
import BorrowAccounts from './output/borrow-48-accounts.json';

/**
 * This script encodes the following transactions:
 * - Run final settlement for wUSDM holders
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const finalSettlement = FinalSettlementViaInternalSwapProxy__factory.connect(
    ModuleDeployments.FinalSettlementViaInternalSwapProxyV1[network].address,
    core.hhUser1,
  );

  const supplyAccounts = BorrowAccounts.map(() => ({
    owner: '0x52256ef863a713Ef349ae6E97A7E8f35785145dE',
    number: '0',
  }));

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, { finalSettlement }, 'finalSettlement', 'ownerSettle', [
      BorrowAccounts,
      supplyAccounts,
      48,
      17,
      { value: ONE_BI },
    ]),
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
    },
  };
}

doDryRunAndCheckDeployment(main);

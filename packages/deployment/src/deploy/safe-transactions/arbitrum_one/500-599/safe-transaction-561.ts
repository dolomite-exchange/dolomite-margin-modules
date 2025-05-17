import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { FinalSettlementViaInternalSwapProxy__factory } from '../../../../../../base/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModulesDeployment from '../../../deployments.json';
import matchBorrowersWithSuppliers from './match-grai-borrowers-with-suppliers';

/**
 * This script encodes the following transactions:
 * - Execute final settlement against chunked positions
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const finalSettlement = FinalSettlementViaInternalSwapProxy__factory.connect(
    ModulesDeployment.FinalSettlementViaInternalSwapProxyV1[network].address,
    core.hhUser1,
  );

  const { borrowers, suppliers } = await matchBorrowersWithSuppliers(core);
  const borrowAccounts = borrowers.slice(124, 156);
  const supplyAccounts = suppliers.slice(124, 156);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { finalSettlement },
      'finalSettlement',
      'ownerSettle',
      [
        borrowAccounts,
        supplyAccounts,
        core.marketIds.grai,
        core.marketIds.nativeUsdc,
        { value: parseEther(`${0.0025}`) },
      ],
      { submitAndExecuteImmediately: true },
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

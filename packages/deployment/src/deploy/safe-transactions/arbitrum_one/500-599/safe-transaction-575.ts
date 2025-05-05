import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { FinalSettlementViaInternalSwapProxy__factory } from '../../../../../../base/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModulesDeployment from '../../../deployments.json';

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

  const accounts = [
    {
      owner: '0xec0f08bc015a0d0fba1df0b8b11d4779f5a04326',
      number: '83739606014428120693479726400323499703449033428325717469693567927919900459359',
    },
    {
      owner: '0xec0f08bc015a0d0fba1df0b8b11d4779f5a04326',
      number: '41151503422338736178515563136745814916286501924411901014410917272325291445221',
    },
  ];
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { finalSettlement },
      'finalSettlement',
      'ownerForceWithdraw',
      [accounts, core.marketIds.grai],
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

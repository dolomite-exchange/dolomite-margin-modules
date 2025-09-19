import { FinalSettlementViaInternalSwapProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { chunk } from '../../../../../../base/src/utils';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetIsCollateralOnly,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import AllSupplyAccounts from './output/all-supply-48-accounts-1.json';

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

  const chunks = chunk(AllSupplyAccounts, 20);

  const transactions: EncodedTransaction[] = [
    ...(await Promise.all(
      chunks.map((chunk) =>
        prettyPrintEncodedDataWithTypeSafety(core, { finalSettlement }, 'finalSettlement', 'ownerForceWithdraw', [
          chunk,
          core.marketIds.wusdm,
        ]),
      ),
    )),
    await encodeSetSupplyCap(core, core.marketIds.wusdm, ONE_BI),
    await encodeSetIsCollateralOnly(core, core.marketIds.wusdm, true),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);

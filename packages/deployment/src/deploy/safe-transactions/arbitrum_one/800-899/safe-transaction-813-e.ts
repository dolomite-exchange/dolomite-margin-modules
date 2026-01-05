import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { JonesUSDCIsolationModeTokenVaultV4__factory } from 'packages/jones/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

import Suppliers from './jusdc-suppliers-3.json';

/**
 * This script encodes the following transactions:
 * - Updates jUSDC to include an extra function for final settlement
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  let nonce = await core.hhUser1.getTransactionCount();
  for (const supplier of Suppliers) {
    const vault = JonesUSDCIsolationModeTokenVaultV4__factory.connect(supplier.owner, core.hhUser1);
    const amount = await core.dolomiteMargin.getAccountWei(supplier, core.marketIds.djUsdcV2);
    if (!amount.value.eq(ZERO_BI)) {
      await vault.handlerWithdrawFromVault(supplier.number, amount.value, { gasLimit: 10_000_000, nonce: nonce++ });
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions: [],
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      logGasUsage: true,
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

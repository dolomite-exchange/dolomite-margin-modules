import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsCollateralOnly } from '../../../../utils/invariant-utils';
import { deployDolomiteErc4626Token } from 'packages/deployment/src/utils/deploy-utils';
import { encodeSetupDolomite4626Token } from 'packages/deployment/src/utils/encoding/dolomite-4626-token-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploys dToken for wgBera
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const wgBera = await deployDolomiteErc4626Token(core, 'WgBera', core.marketIds.wgBera);
  const transactions: EncodedTransaction[] = [
    ...await encodeSetupDolomite4626Token(core, wgBera),
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
      await checkIsCollateralOnly(core, core.marketIds.wgBera, true);
    },
  };
}

doDryRunAndCheckDeployment(main);

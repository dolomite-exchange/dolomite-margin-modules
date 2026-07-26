import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Update oDOLO Rolling Claims
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const rollingClaimsV3Address = await deployContractAndSave(
    'RollingClaims',
    [
      core.tokenomics.oDolo.address,
      core.dolomiteRegistry.address,
      core.dolomiteMargin.address,
    ],
    getMaxDeploymentVersionNameByDeploymentKey('ODoloRollingClaimsImplementation', 3),
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { rollingClaims: core.tokenomics.rollingClaimsProxy },
      'rollingClaims',
      'upgradeTo',
      [rollingClaimsV3Address],
    ),
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
      await printPriceForVisualCheck(core, core.tokens.savUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);

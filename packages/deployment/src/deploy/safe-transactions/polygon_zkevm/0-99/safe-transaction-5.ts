import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Unsets the GenericTraderProxyLib as a global operator
 * - Sets the GenericTraderProxy as a global operator
 */
async function main(): Promise<DryRunOutput<Network.PolygonZkEvm>> {
  const network = await getAndCheckSpecificNetwork(Network.PolygonZkEvm);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [CoreDeployments.GenericTraderProxyV1Lib[network].address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.genericTraderProxy.address, true],
    ),
  );
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(CoreDeployments.GenericTraderProxyV1Lib[network].address)),
        'GenericTraderProxyV1Lib should not be a global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(core.genericTraderProxy.address),
        'GenericTraderProxy should be a global operator',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

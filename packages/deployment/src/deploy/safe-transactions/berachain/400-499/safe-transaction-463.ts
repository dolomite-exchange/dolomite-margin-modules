import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { RollingClaims__factory } from 'packages/tokenomics/src/types';
import { getRegistryProxyConstructorParams } from '../../../../../../base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsGlobalOperator } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploy and set up oDOLO Rolling Claims
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const rollingClaimsImplementationAddress = await deployContractAndSave(
    'RollingClaims',
    [core.tokenomics.oDolo.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'ODoloRollingClaimsImplementationV1',
  );
  const rollingClaimsImplementation = RollingClaims__factory.connect(rollingClaimsImplementationAddress, core.hhUser1);
  const callData = await rollingClaimsImplementation.populateTransaction.initialize();
  const rollingClaimsProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(rollingClaimsImplementationAddress, callData.data!, core.dolomiteMargin),
    'ODoloRollingClaimsProxy',
  );
  const rollingClaimsProxy = RollingClaims__factory.connect(rollingClaimsProxyAddress, core.hhUser1);

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(core, { rollingClaimsProxy }, 'rollingClaimsProxy', 'ownerSetHandler', [
      core.tokenomics.handlerAddress,
    ]),
    await encodeSetGlobalOperator(core, rollingClaimsProxy, true),
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
      await checkIsGlobalOperator(core, rollingClaimsProxy, true);
      expect(await rollingClaimsProxy.handler()).to.eq(core.tokenomics.handlerAddress);
      expect(await rollingClaimsProxy.currentEpoch()).to.eq(ZERO_BI);
    },
  };
}

doDryRunAndCheckDeployment(main);

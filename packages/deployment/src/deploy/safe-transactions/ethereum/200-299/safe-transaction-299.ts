import { parseEther } from 'ethers/lib/utils';
import { AdminSetRiskParams__factory, PartnerClaimExcessTokens__factory } from 'packages/admin/src/types';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  ALL_FUNCTIONS,
  encodeAddressForRole,
  encodeAddressToFunctionSelectorForRole,
  encodeGrantAdminRegistryPermissionIfNecessary,
  encodeGrantBypassTimelockAndExecutorRolesIfNecessary,
  encodeGrantRoleIfNecessary,
} from '../../../../utils/encoding/dolomite-owner-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the admin set risk params contract
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const adminSetRiskParamsAddress = await deployContractAndSave(
    'AdminSetRiskParams',
    [core.dolomiteAccountRiskOverrideSetter.address, core.adminRegistry.address, core.dolomiteMargin.address],
    'AdminSetRiskParamsV1'
  )
  const adminSetRiskParams = AdminSetRiskParams__factory.connect(
    adminSetRiskParamsAddress,
    core.hhUser1,
  );

  const adminSetRiskParamsRole = await adminSetRiskParams.ADMIN_SET_RISK_PARAMS_ROLE();
  const transactions: EncodedTransaction[] = [
    ...(await encodeGrantRoleIfNecessary(core, adminSetRiskParamsRole, adminSetRiskParams)),
    ...(await encodeGrantBypassTimelockAndExecutorRolesIfNecessary(core, adminSetRiskParams)),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMaxSupplyWei'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMaxBorrowWei'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetMarginPremium'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminSetRiskParamsRole,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerSetLiquidationSpreadPremium'),
    )),
    ...(await encodeAddressForRole( // @dev, adminSetRiskParams can call all functions on the dolomite risk override setter
      core,
      adminSetRiskParamsRole,
      core.dolomiteAccountRiskOverrideSetter
    )),
    ...(await encodeGrantAdminRegistryPermissionIfNecessary(
      core,
      core.adminRegistry,
      ALL_FUNCTIONS,
      adminSetRiskParams,
      core.gnosisSafe // @follow-up I assume you only want the gnosis safe to be able to call these functions?
    ))
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

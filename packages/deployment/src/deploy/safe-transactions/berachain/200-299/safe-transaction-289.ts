import { parseEther } from 'ethers/lib/utils';
import { PartnerClaimExcessTokens__factory } from 'packages/admin/src/types';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeAddressToFunctionSelectorForRole,
  encodeGrantBypassTimelockAndExecutorRolesIfNecessary,
  encodeGrantRoleIfNecessary,
} from '../../../../utils/encoding/dolomite-owner-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploy the partner claim excess tokens
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const partnerClaimExcessTokensAddress = await deployContractAndSave(
    'PartnerClaimExcessTokens',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'PartnerClaimExcessTokensV1',
  );
  const partnerClaimExcessTokens = PartnerClaimExcessTokens__factory.connect(
    partnerClaimExcessTokensAddress,
    core.hhUser1,
  );

  const adminClaimExcessTokens = await partnerClaimExcessTokens.ADMIN_CLAIM_EXCESS_TOKENS_ROLE();
  const transactions: EncodedTransaction[] = [
    ...(await encodeGrantRoleIfNecessary(core, adminClaimExcessTokens, partnerClaimExcessTokens)),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      adminClaimExcessTokens,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
    )),
    ...(await encodeGrantBypassTimelockAndExecutorRolesIfNecessary(core, partnerClaimExcessTokens)),
    ...(await encodeSetGlobalOperatorIfNecessary(core, partnerClaimExcessTokens, true)),
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
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.wbera,
        core.hhUser1.address,
        { value: parseEther('0.1') },
      );
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser1.address,
        { value: parseEther('0.1') },
      );

      const treasury = await impersonate(await core.dolomiteRegistry.treasury());
      await partnerClaimExcessTokens.connect(treasury).claimExcessTokens(core.tokens.wbera.address, true);
      await partnerClaimExcessTokens.connect(treasury).claimExcessTokens(core.tokens.usdc.address, false);
    },
  };
}

doDryRunAndCheckDeployment(main);

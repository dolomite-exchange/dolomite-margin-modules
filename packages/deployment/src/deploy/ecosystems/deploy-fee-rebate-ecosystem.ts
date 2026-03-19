import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IAdminRegistry__factory } from 'packages/admin/src/types';
import { getRegistryProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { FeeRebateClaimer__factory, FeeRebateRollingClaims__factory } from 'packages/tokenomics/src/types';
import { deployContractAndSave, TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';
import getScriptName from '../../utils/get-script-name';
import { encodeSetGlobalOperator } from '../../utils/encoding/dolomite-margin-core-encoder-utils';

const HANDLER_ADDRESS = '0xdf86dfdf493bcd2b838a44726a1e58f66869ccbe';

/**
 * This script encodes the following transactions:
 * - Deploys FeeRebateClaimer behind RegistryProxy
 * - Deploys FeeRebateRollingClaims behind RegistryProxy
 * - Wires permissions and owner settings for fee rebate claiming
 */
async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  // TODO: replace handler address
  const feeRebateClaimerImplementationAddress = await deployContractAndSave(
    'FeeRebateClaimer',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'FeeRebateClaimerImplementationV1',
  );
  const feeRebateClaimerImplementation = FeeRebateClaimer__factory.connect(
    feeRebateClaimerImplementationAddress,
    core.hhUser1,
  );
  const feeRebateClaimerInitCalldata = await feeRebateClaimerImplementation.populateTransaction.initialize();
  const feeRebateClaimerProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      feeRebateClaimerImplementationAddress,
      feeRebateClaimerInitCalldata.data!,
      core.dolomiteMargin,
    ),
    'FeeRebateClaimerProxy',
  );
  const feeRebateClaimerProxy = FeeRebateClaimer__factory.connect(feeRebateClaimerProxyAddress, core.hhUser1);

  const feeRebateRollingClaimsImplementationAddress = await deployContractAndSave(
    'FeeRebateRollingClaims',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    'FeeRebateRollingClaimsImplementationV1',
  );
  const feeRebateRollingClaimsImplementation = FeeRebateRollingClaims__factory.connect(
    feeRebateRollingClaimsImplementationAddress,
    core.hhUser1,
  );
  const feeRebateRollingClaimsInitCalldata = await feeRebateRollingClaimsImplementation.populateTransaction.initialize();
  const feeRebateRollingClaimsProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      feeRebateRollingClaimsImplementationAddress,
      feeRebateRollingClaimsInitCalldata.data!,
      core.dolomiteMargin,
    ),
    'FeeRebateRollingClaimsProxy',
  );
  const feeRebateRollingClaimsProxy = FeeRebateRollingClaims__factory.connect(
    feeRebateRollingClaimsProxyAddress,
    core.hhUser1,
  );

  const adminRegistry = IAdminRegistry__factory.connect(
    await core.adminClaimExcessTokens.ADMIN_REGISTRY(),
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    await encodeSetGlobalOperator(core, feeRebateRollingClaimsProxy, true),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateClaimerProxy },
      'feeRebateClaimerProxy',
      'ownerSetHandler',
      [HANDLER_ADDRESS],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateClaimerProxy },
      'feeRebateClaimerProxy',
      'ownerSetAdminFeeClaimer',
      [core.adminClaimExcessTokens.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateRollingClaimsProxy },
      'feeRebateRollingClaimsProxy',
      'ownerSetHandler',
      [HANDLER_ADDRESS],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateRollingClaimsProxy },
      'feeRebateRollingClaimsProxy',
      'ownerSetFeeRebateClaimer',
      [feeRebateClaimerProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateRollingClaimsProxy },
      'feeRebateRollingClaimsProxy',
      'ownerSetClaimEnabled',
      [true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { adminRegistry }, 'adminRegistry', 'grantPermission', [
      core.adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
      core.adminClaimExcessTokens.address,
      feeRebateClaimerProxy.address,
    ]),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
      meta: {
        name: 'Fee Rebate Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await feeRebateClaimerProxy.handler()) === HANDLER_ADDRESS,
        'Invalid handler on feeRebateClaimerProxy',
      );
      assertHardhatInvariant(
        (await feeRebateClaimerProxy.adminFeeClaimer()) === core.adminClaimExcessTokens.address,
        'Invalid admin fee claimer on feeRebateClaimerProxy',
      );

      assertHardhatInvariant(
        (await feeRebateRollingClaimsProxy.handler()) === HANDLER_ADDRESS,
        'Invalid handler on feeRebateRollingClaimsProxy',
      );
      assertHardhatInvariant(
        (await feeRebateRollingClaimsProxy.feeRebateClaimer()) === feeRebateClaimerProxy.address,
        'Invalid fee rebate claimer on feeRebateRollingClaimsProxy',
      );
      assertHardhatInvariant(
        await feeRebateRollingClaimsProxy.claimEnabled(),
        'Claiming is not enabled on feeRebateRollingClaimsProxy',
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(feeRebateRollingClaimsProxy.address),
        'FeeRebateRollingClaimsProxy is not global operator',
      );
      assertHardhatInvariant(
        await adminRegistry.hasPermission(
          core.adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
          core.adminClaimExcessTokens.address,
          feeRebateClaimerProxy.address,
        ),
        'FeeRebateClaimerProxy is not approved to claim admin excess tokens',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);

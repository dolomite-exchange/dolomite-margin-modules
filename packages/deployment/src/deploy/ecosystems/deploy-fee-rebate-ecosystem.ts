import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IAdminRegistry__factory } from 'packages/admin/src/types';
import { getRegistryProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { FeeRebateClaimer__factory, FeeRebateRollingClaims__factory } from 'packages/tokenomics/src/types';
import { deployContractAndSave, TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';
import getScriptName from '../../utils/get-script-name';
import { encodeSetGlobalOperator } from '../../utils/encoding/dolomite-margin-core-encoder-utils';
import { expect } from 'chai';

const HANDLER_ADDRESS = '0xdf86dfdf493bcd2b838a44726a1e58f66869ccbe';
const REVENUE_SWEEPER_ADDRESS = '0x59a8FE1333F7fE907639D94C39538608DE33F6c5';

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
  // tslint:disable-next-line:max-line-length
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
    await encodeSetGlobalOperator(core, feeRebateClaimerProxy, true),
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
      { feeRebateClaimerProxy },
      'feeRebateClaimerProxy',
      'ownerSetFeeRebateRollingClaims',
      [feeRebateRollingClaimsProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { feeRebateClaimerProxy },
      'feeRebateClaimerProxy',
      'ownerSetRevenueSweeper',
      [REVENUE_SWEEPER_ADDRESS],
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
      [false],
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
        (await feeRebateClaimerProxy.feeRebateRollingClaims()) === feeRebateRollingClaimsProxy.address,
        'Invalid fee rebate rolling claims on feeRebateClaimerProxy',
      );
      assertHardhatInvariant(
        (await feeRebateClaimerProxy.revenueSweeper()) === REVENUE_SWEEPER_ADDRESS,
        'Invalid revenue sweeper on feeRebateClaimerProxy',
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
        !(await feeRebateRollingClaimsProxy.claimEnabled()),
        'Claiming is enabled on feeRebateRollingClaimsProxy',
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(feeRebateRollingClaimsProxy.address),
        'FeeRebateRollingClaimsProxy is not global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(feeRebateClaimerProxy.address),
        'FeeRebateClaimerProxy is not global operator',
      );
      assertHardhatInvariant(
        await adminRegistry.hasPermission(
          core.adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
          core.adminClaimExcessTokens.address,
          feeRebateClaimerProxy.address,
        ),
        'FeeRebateClaimerProxy is not approved to claim admin excess tokens',
      );

      if ((await core.dolomiteMargin.getNumMarkets()).gt(0)) {
        const handler = await impersonate(HANDLER_ADDRESS);

        expect(await feeRebateClaimerProxy.epoch()).to.eq(0);

        await feeRebateClaimerProxy
          .connect(handler)
          .handlerClaimRewardsByEpochAndMarketId(1, [core.marketIds.usdc], true);

        expect(await feeRebateClaimerProxy.epoch()).to.eq(1);
        expect(await feeRebateClaimerProxy.getClaimAmountByEpochAndMarketId(1, core.marketIds.usdc)).to.not.eq(0);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

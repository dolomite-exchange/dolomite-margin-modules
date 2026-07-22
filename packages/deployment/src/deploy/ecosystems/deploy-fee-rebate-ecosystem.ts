import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { expect } from 'chai';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IAdminRegistry__factory } from 'packages/admin/src/types';
import { getRegistryProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { getAnyNetwork } from 'packages/base/src/utils/dolomite-utils';
import { DolomiteNetwork, Network, ONE_WEEK_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { advanceByTimeDelta, getRealLatestBlockNumber, impersonate } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { FeeRebateClaimer__factory, FeeRebateRollingClaims__factory } from 'packages/tokenomics/src/types';
import {
  deployContractAndSave,
  getMaxDeploymentVersionNameByDeploymentKey,
  TRANSACTION_BUILDER_VERSION,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../utils/get-script-name';

const HANDLER_ADDRESS = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe';
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

  const serverEpoch = await fetch('https://api.dolomite.io/liquidity-mining/ve-dolo-rebate/metadata')
    .then((response) => response.json())
    .then((json) => json['metadata']['currentEpochIndex']);

  const feeRebateClaimerImplementationAddress = await deployContractAndSave(
    'FeeRebateClaimer',
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('FeeRebateClaimerImplementation', 5),
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
    getMaxDeploymentVersionNameByDeploymentKey('FeeRebateRollingClaimsImplementation', 4),
  );
  const feeRebateRollingClaimsImplementation = FeeRebateRollingClaims__factory.connect(
    feeRebateRollingClaimsImplementationAddress,
    core.hhUser1,
  );
  // tslint:disable-next-line
  const feeRebateRollingClaimsInitCalldata = await feeRebateRollingClaimsImplementation.populateTransaction[
    'initialize(address)'
    // tslint:disable-next-line
  ](feeRebateClaimerProxy.address);
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
    ...(await encodeSetGlobalOperatorIfNecessary(core, feeRebateRollingClaimsProxy, true)),
    ...(await encodeSetGlobalOperatorIfNecessary(core, feeRebateClaimerProxy, true)),
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
      'ownerSetClaimEnabled',
      [false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { adminRegistry }, 'adminRegistry', 'grantPermission', [
      core.adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
      core.adminClaimExcessTokens.address,
      feeRebateClaimerProxy.address,
    ]),
  ];

  {
    const proxy = RegistryProxy__factory.connect(feeRebateClaimerProxyAddress, core.hhUser1);
    if (
      (await proxy.implementation()) !== feeRebateClaimerImplementationAddress &&
      core.network === Network.Berachain
    ) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { feeRebateClaimerProxy: proxy },
          'feeRebateClaimerProxy',
          'upgradeTo',
          [feeRebateClaimerImplementationAddress],
        ),
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { feeRebateClaimerProxy },
          'feeRebateClaimerProxy',
          'initializeV4',
          [
            [
              core.marketIds.weth,
              core.marketIds.wbera,
              core.marketIds.usdc,
              core.marketIds.honey,
              core.marketIds.wbtc,
              core.marketIds.usdt,
              core.marketIds.rUsd,
              core.marketIds.usde,
              core.marketIds.iBera,
              core.marketIds.byusd,
            ],
          ],
        ),
      );
    }
  }
  {
    const proxy = RegistryProxy__factory.connect(feeRebateRollingClaimsProxyAddress, core.hhUser1);
    if ((await proxy.implementation()) !== feeRebateRollingClaimsImplementationAddress) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { feeRebateRollingClaimsProxy: proxy },
          'feeRebateRollingClaimsProxy',
          'upgradeTo',
          [feeRebateRollingClaimsImplementationAddress],
        ),
      );
    }
  }

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
      console.log('\tStart timestamp: ', (await feeRebateClaimerProxy.startTimestamp()).toNumber());
      console.log('\tStart epoch: ', (await feeRebateClaimerProxy.currentEpoch()).toNumber());

      // the contracts should start one behind the server
      assertHardhatInvariant(
        (await feeRebateClaimerProxy.currentEpoch()).add(1).eq(serverEpoch),
        'Invalid epoch on feeRebateClaimerProxy',
      );
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

      // the contracts should start one behind the server
      assertHardhatInvariant(
        (await feeRebateRollingClaimsProxy.currentEpoch()).add(1).eq(serverEpoch),
        'Invalid epoch on feeRebateClaimerProxy',
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
        await advanceByTimeDelta(ONE_WEEK_SECONDS);
        expect(await feeRebateClaimerProxy.currentEpoch()).to.eq(serverEpoch - 1);

        console.log(`\tPerforming claim for USDC for epoch ${serverEpoch}...`);
        await feeRebateClaimerProxy
          .connect(handler)
          .handlerClaimRewardsByEpochAndMarketId(serverEpoch, [core.marketIds.usdc], true);
        console.log(`\tSuccessfully claimed for USDC for epoch ${serverEpoch}...`);

        expect(await feeRebateClaimerProxy.currentEpoch()).to.eq(serverEpoch);
        expect(await feeRebateClaimerProxy.getClaimAmountByEpochAndMarketId(1, core.marketIds.usdc)).to.not.eq(0);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

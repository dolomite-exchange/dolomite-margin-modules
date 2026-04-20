import {
  AdminClaimExcessTokens,
  AdminPauseMarket,
  AdminRegistry,
  AdminSetInterestSetter,
  DolomiteOwnerV2,
} from 'packages/admin/src/types';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { IDolomiteMargin, IDolomiteMarginV2, RegistryProxy__factory } from '../../../../../base/src/types';
import {
  ADMIN_CLAIM_EXCESS_TOKENS_ROLE,
  ADMIN_PAUSE_MARKET_ROLE,
  BYPASS_TIMELOCK_ROLE,
  EXECUTOR_ROLE,
} from '../../../../../base/src/utils/no-deps-constants';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import { setupDolomiteOwnerV2 } from '../../../utils/encoding/dolomite-4626-token-encoder-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  ALL_FUNCTIONS,
  encodeAddressToFunctionSelectorForRole,
  encodeGrantAdminRegistryPermissionIfNecessary,
  encodeGrantRoleIfNecessary,
  encodeRevokeRoleIfNecessary,
} from '../../../utils/encoding/dolomite-owner-encoder-utils';
import { getMaxDeploymentVersionNumberByDeploymentKey } from '../../../utils/deploy-utils';
import { ModuleDeployments } from '../../../utils';

export async function encodeDolomiteOwnerMigrations(
  dolomiteOwner: DolomiteOwnerV2,
  adminRegistry: AdminRegistry,
  adminRegistryImplementationAddress: string,
  adminClaimExcessTokens: AdminClaimExcessTokens,
  adminPauseMarket: AdminPauseMarket,
  adminSetInterestSetter: AdminSetInterestSetter,
  transactions: EncodedTransaction[],
  core: any,
) {
  const dolomiteMargin = core.dolomiteMargin as IDolomiteMargin | IDolomiteMarginV2;
  const dolomiteMarginWithOwnable = Ownable__factory.connect(dolomiteMargin.address, core.hhUser1);
  if ((await dolomiteMarginWithOwnable.owner()) !== dolomiteOwner.address) {
    transactions.length = 0;

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: dolomiteMarginWithOwnable },
        'dolomiteMargin',
        'transferOwnership',
        [dolomiteOwner.address],
        { skipWrappingCalldataInSubmitTransaction: true },
      ),
    );

    console.warn(
      'Migrations for the DolomiteOwnerV2 contract will need to be re-run once ownership has been transferred',
    );
  } else {
    const adminRegistryProxy = RegistryProxy__factory.connect(adminRegistry.address, core.hhUser1);
    if (await adminRegistryProxy.implementation() !== adminRegistryImplementationAddress) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { adminRegistryProxy },
          'adminRegistryProxy',
          'upgradeTo',
          [adminRegistryImplementationAddress],
        ),
      );
    }

    transactions.push(...(await setupDolomiteOwnerV2(core)));

    // Dolomite Owner Roles - AdminClaimExcessTokens
    transactions.push(
      ...(await encodeGrantRoleIfNecessary(core, BYPASS_TIMELOCK_ROLE, adminClaimExcessTokens)),
      ...(await encodeGrantRoleIfNecessary(core, EXECUTOR_ROLE, adminClaimExcessTokens)),
      ...(await encodeGrantRoleIfNecessary(core, ADMIN_CLAIM_EXCESS_TOKENS_ROLE, adminClaimExcessTokens)),
      ...(await encodeAddressToFunctionSelectorForRole(
        core,
        ADMIN_CLAIM_EXCESS_TOKENS_ROLE,
        dolomiteMargin,
        dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
      )),
      ...(await encodeSetGlobalOperatorIfNecessary(core, adminClaimExcessTokens, true)),
    );

    // Dolomite Owner Roles - AdminPauseMarket
    transactions.push(
      ...(await encodeGrantRoleIfNecessary(core, BYPASS_TIMELOCK_ROLE, adminPauseMarket)),
      ...(await encodeGrantRoleIfNecessary(core, EXECUTOR_ROLE, adminPauseMarket)),
      ...(await encodeGrantRoleIfNecessary(core, ADMIN_PAUSE_MARKET_ROLE, adminPauseMarket)),
      ...(await encodeAddressToFunctionSelectorForRole(
        core,
        ADMIN_PAUSE_MARKET_ROLE,
        dolomiteMargin,
        dolomiteMargin.interface.getFunction('ownerSetPriceOracle'),
      )),
    );

    // Admin Registry functions
    transactions.push(
      ...(
        await encodeGrantAdminRegistryPermissionIfNecessary(
          core,
          adminRegistry,
          ALL_FUNCTIONS,
          adminClaimExcessTokens,
          core.gnosisSafeAddress,
        )
      ),
      ...(
        await encodeGrantAdminRegistryPermissionIfNecessary(
          core,
          adminRegistry,
          ALL_FUNCTIONS,
          adminPauseMarket,
          core.gnosisSafeAddress,
        )
      ),
      ...(
        await encodeGrantAdminRegistryPermissionIfNecessary(
          core,
          adminRegistry,
          ALL_FUNCTIONS,
          adminSetInterestSetter,
          core.gnosisSafeAddress,
        )
      ),
    );
  }
}

export async function encodeDolomiteOwnerRegressions(
  transactions: EncodedTransaction[],
  core: any,
) {
  async function revokeContractOwnership(nameWithoutVersionPostfix: string, role: string) {
    const version = getMaxDeploymentVersionNumberByDeploymentKey(nameWithoutVersionPostfix, 1);
    for (let i = 1; i < version; i++) {
      // Dolomite Owner Roles - AdminClaimExcessTokens
      const deploymentName = `${nameWithoutVersionPostfix}V${i}`;
      const contractAddress = (ModuleDeployments as any)[deploymentName][core.network]?.address;
      if (!contractAddress) {
        continue;
      }
      const contract = { address: contractAddress };
      transactions.push(
        ...(await encodeRevokeRoleIfNecessary(core, BYPASS_TIMELOCK_ROLE, contract)),
        ...(await encodeRevokeRoleIfNecessary(core, EXECUTOR_ROLE, contract)),
        ...(await encodeRevokeRoleIfNecessary(core, role, contract)),
        ...(await encodeSetGlobalOperatorIfNecessary(core, contract, false)),
      );
    }
  }

  await revokeContractOwnership('AdminClaimExcessTokens', ADMIN_CLAIM_EXCESS_TOKENS_ROLE);
  await revokeContractOwnership('AdminPauseMarket', ADMIN_PAUSE_MARKET_ROLE);
}

import { DolomiteNetwork } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { FunctionFragment } from '@ethersproject/abi';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { AdminRegistry } from 'packages/admin/src/types';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

function toBytes32(hex: string): string {
  return `${hex}${'0'.repeat(66 - hex.length)}`;
}

export async function encodeGrantSpecialRolesIfNecessary<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  destination: { address: string },
  bypassTimelockRole: boolean,
  executorRole: boolean,
  verifierRole: boolean,
) {
  const transactions: EncodedTransaction[] = [];

  if (bypassTimelockRole) {
    transactions.push(...(await encodeGrantRoleIfNecessary(core, await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE(), destination)));
  }

  if (executorRole) {
    transactions.push(...(await encodeGrantRoleIfNecessary(core, await core.ownerAdapterV2.EXECUTOR_ROLE(), destination)));
  }

  if (verifierRole) {
    if (!core.ownerAdapterV3) {
      throw new Error("Cannot add verifier role on ownerAdapterV2");
    }
    transactions.push(...(await encodeGrantRoleIfNecessary(core, await core.ownerAdapterV3.VERIFIER_ROLE(), destination)));
  }
  
  return transactions;
}

export async function encodeGrantBypassTimelockAndExecutorRolesIfNecessary<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  destination: { address: string },
) {
  return [
    ...(await encodeGrantRoleIfNecessary(core, await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE(), destination)),
    ...(await encodeGrantRoleIfNecessary(core, await core.ownerAdapterV2.EXECUTOR_ROLE(), destination)),
  ];
}

export async function encodeGrantRoleIfNecessary<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  role: string,
  destination: { address: string },
) {
  assertHardhatInvariant(role.length === 66, 'Invalid role!');

  const transactions: EncodedTransaction[] = [];

  if (core.ownerAdapterV3) {
    if (!(await core.ownerAdapterV3.hasRole(role, destination.address))) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { ownerAdapterV3: core.ownerAdapterV3 },
          'ownerAdapterV3',
          'grantRole',
          [role, destination.address],
        ),
      );
    }
  } else {
    if (!(await core.ownerAdapterV2.isRole(role))) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { ownerAdapterV2: core.ownerAdapterV2 },
          'ownerAdapterV2',
          'ownerAddRole',
          [role],
        ),
      );
    }

    if (!(await core.ownerAdapterV2.hasRole(role, destination.address))) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { ownerAdapterV2: core.ownerAdapterV2 },
          'ownerAdapterV2',
          'grantRole',
          [role, destination.address],
        ),
      );
    }
  }

  return transactions;
}

export async function encodeAddressToFunctionSelectorForRole<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  role: string,
  destination: { address: string },
  fragment: FunctionFragment,
) {
  assertHardhatInvariant(role.length === 66, 'Invalid role!');
  assertHardhatInvariant(!core.ownerAdapterV3, "This function is not valid with ownerAdapterV3");

  const selectorsBytes32 = await core.ownerAdapterV2.getRoleToAddressFunctionSelectors(role, destination.address);

  const transactions = [];
  const selector = core.dolomiteMargin.interface.getSighash(fragment);
  if (!selectorsBytes32.includes(toBytes32(selector))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { ownerAdapterV2: core.ownerAdapterV2 },
        'ownerAdapterV2',
        'ownerAddRoleToAddressFunctionSelectors',
        [role, destination.address, [selector]],
      ),
    );
  }

  return transactions;
}

export async function encodeAddressForRole<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  role: string,
  destination: { address: string }
) {
  assertHardhatInvariant(role.length === 66, 'Invalid role!');
  assertHardhatInvariant(!core.ownerAdapterV3, "This function is not valid with ownerAdapterV3");

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapterV2: core.ownerAdapterV2 },
      'ownerAdapterV2',
      'ownerAddRoleAddresses',
      [role, [destination.address]],
    ),
  );

  return transactions;
}

export const ALL_FUNCTIONS = '0x11111111';

export async function encodeGrantAdminRegistryPermissionIfNecessary<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  adminRegistry: AdminRegistry,
  selector: string | typeof ALL_FUNCTIONS,
  contract: { address: string },
  account: string | { address: string },
) {
  if (selector.length !== 10) {
    return Promise.reject(new Error('Invalid selector'));
  }

  const transactions: EncodedTransaction[] = [];
  if (
    !(await adminRegistry.hasPermission(
      selector,
      contract.address,
      typeof account === 'string' ? account : account.address,
    ))
  ) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { adminRegistry }, 'adminRegistry', 'grantPermission', [
        selector,
        contract.address,
        core.gnosisSafeAddress,
      ]),
    );
  }

  return transactions;
}

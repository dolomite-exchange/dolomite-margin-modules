import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { FunctionFragment } from '@ethersproject/abi';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

function toBytes32(hex: string): string {
  return `${hex}${'0'.repeat(66 - hex.length)}`;
}

export async function encodeGrantRole<T extends NetworkType>(
  core: CoreProtocolType<T>,
  role: string,
  destination: { address: string },
) {
  assertHardhatInvariant(role.length === 66, 'Invalid role!');

  const transactions: EncodedTransaction[] = [];
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

  return transactions;
}

export async function encodeAddressToFunctionSelectorForRole<T extends NetworkType>(
  core: CoreProtocolType<T>,
  role: string,
  destination: { address: string },
  fragment: FunctionFragment,
) {
  assertHardhatInvariant(role.length === 66, 'Invalid role!');

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

import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { EncodedTransaction } from '../dry-run-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';

function toBytes32(hex: string): string {
  return `${hex}${'0'.repeat(66 - hex.length)}`;
}

export async function encodeAddressToFunctionSelectorForRoleIfNecessary<T extends NetworkType>(
  core: CoreProtocolType<T>,
  transactions: EncodedTransaction[],
  role: string,
  destination: { address: string },
  selector: string,
) {
  assertHardhatInvariant(selector.length === 10, 'Invalid selector!');

  const selectorsBytes32 = await core.ownerAdapterV2.getRoleToAddressFunctionSelectors(
    role,
    destination.address,
  );

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
}

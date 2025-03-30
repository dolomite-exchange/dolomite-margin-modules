import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { DolomiteERC4626 } from '../../../../base/src/types';
import { NetworkType } from '../../../../base/src/utils/no-deps-constants';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';
import { encodeSetGlobalOperator } from './dolomite-margin-core-encoder-utils';
import { encodeAddressToFunctionSelectorForRoleIfNecessary } from './dolomite-owner-encoder-utils';

export const D_TOKEN_ROLE = '0xcd86ded6d567eb7adb1b98d283b7e4004869021f7651dbae982e0992bfe0df5a';
const OWNER_WITHDRAW_EXCESS_TOKENS_SELECTOR = '0x8f6bc659';
const OWNER_SET_MAX_WEI_SELECTOR = '0x0cd30a0e';

export async function setupDolomiteOwnerV2<T extends NetworkType>(
  core: CoreProtocolType<T>,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];

  const roles = await core.ownerAdapterV2.getRoles();
  if (!roles.includes(D_TOKEN_ROLE)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { ownerAdapterV2: core.ownerAdapterV2 },
        'ownerAdapterV2',
        'ownerAddRole',
        [D_TOKEN_ROLE],
      ),
    );
  }

  await encodeAddressToFunctionSelectorForRoleIfNecessary(
    core,
    transactions,
    D_TOKEN_ROLE,
    core.dolomiteMargin,
    OWNER_WITHDRAW_EXCESS_TOKENS_SELECTOR,
  );
  await encodeAddressToFunctionSelectorForRoleIfNecessary(
    core,
    transactions,
    D_TOKEN_ROLE,
    core.dolomiteMargin,
    OWNER_SET_MAX_WEI_SELECTOR,
  );

  return transactions;
}

export async function encodeSetupDolomite4626Token<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dToken: DolomiteERC4626,
): Promise<EncodedTransaction[]> {
  const bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
  const executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

  return [
    await encodeSetGlobalOperator(core, dToken, true),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapterV2: core.ownerAdapterV2 },
      'ownerAdapterV2',
      'grantRole',
      [bypassTimelockRole, dToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapterV2: core.ownerAdapterV2 },
      'ownerAdapterV2',
      'grantRole',
      [executorRole, dToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { ownerAdapterV2: core.ownerAdapterV2 },
      'ownerAdapterV2',
      'grantRole',
      [D_TOKEN_ROLE, dToken.address],
    ),
  ];
}

import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { DolomiteERC4626 } from '../../../../base/src/types';
import { D_TOKEN_ROLE, Network, DolomiteNetwork } from '../../../../base/src/utils/no-deps-constants';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from './base-encoder-utils';
import { encodeSetGlobalOperator } from './dolomite-margin-core-encoder-utils';
import { encodeAddressToFunctionSelectorForRole, encodeGrantRoleIfNecessary } from './dolomite-owner-encoder-utils';

export async function setupDolomiteOwnerV2<T extends DolomiteNetwork>(
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

  transactions.push(
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      D_TOKEN_ROLE,
      core.dolomiteMargin,
      core.dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
    )),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      D_TOKEN_ROLE,
      core.dolomiteMargin,
      core.network === Network.ArbitrumOne
        ? core.dolomiteMargin.interface.getFunction('ownerSetMaxWei')
        : core.dolomiteMargin.interface.getFunction('ownerSetMaxSupplyWei'),
    )),
  );

  return transactions;
}

export async function encodeSetupDolomite4626Token<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dToken: DolomiteERC4626,
): Promise<EncodedTransaction[]> {
  const bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
  const executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

  return [
    await encodeSetGlobalOperator(core, dToken, true),
    ...(await encodeGrantRoleIfNecessary(core, bypassTimelockRole, dToken)),
    ...(await encodeGrantRoleIfNecessary(core, executorRole, dToken)),
    ...(await encodeGrantRoleIfNecessary(core, D_TOKEN_ROLE, dToken)),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { 'dolomiteRegistry': core.dolomiteRegistry },
      'dolomiteRegistry',
      'ownerSetMarketIdToDToken',
      [(await dToken.marketId()), dToken.address],
    ),
  ];
}

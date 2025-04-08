import { AdminClaimExcessTokens, AdminPauseMarket, DolomiteOwnerV2 } from 'packages/admin/src/types';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { IDolomiteMargin, IDolomiteMarginV2 } from '../../../../../base/src/types';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import { setupDolomiteOwnerV2 } from '../../../utils/encoding/dolomite-4626-token-encoder-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../../utils/encoding/dolomite-margin-core-encoder-utils';
import {
  encodeAddressToFunctionSelectorForRole,
  encodeGrantRole,
} from '../../../utils/encoding/dolomite-owner-encoder-utils';

export async function encodeDolomiteOwnerMigrations(
  dolomiteOwner: DolomiteOwnerV2,
  adminClaimExcessTokens: AdminClaimExcessTokens,
  adminPauseMarket: AdminPauseMarket,
  transactions: EncodedTransaction[],
  core: any,
) {
  const dolomiteMargin = core.dolomiteMargin as IDolomiteMargin | IDolomiteMarginV2;
  const ownable = Ownable__factory.connect(dolomiteMargin.address, core.hhUser1);
  if ((await ownable.owner()) !== dolomiteOwner.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { ownable }, 'ownable', 'transferOwnership', [
        dolomiteOwner.address,
      ]),
    );
  }

  transactions.push(...(await setupDolomiteOwnerV2(core)));

  const bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
  const executorRole = await dolomiteOwner.EXECUTOR_ROLE();

  const claimExcessTokensRole = await adminClaimExcessTokens.ADMIN_CLAIM_EXCESS_TOKENS_ROLE();
  transactions.push(
    ...(await encodeGrantRole(core, bypassTimelockRole, adminClaimExcessTokens)),
    ...(await encodeGrantRole(core, executorRole, adminClaimExcessTokens)),
    ...(await encodeGrantRole(core, claimExcessTokensRole, adminClaimExcessTokens)),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      claimExcessTokensRole,
      dolomiteMargin,
      dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
    )),
    ...(await encodeSetGlobalOperatorIfNecessary(core, adminClaimExcessTokens, true)),
  );

  const pauseMarketRole = await adminPauseMarket.ADMIN_PAUSE_MARKET_ROLE();
  transactions.push(
    ...(await encodeGrantRole(core, bypassTimelockRole, adminPauseMarket)),
    ...(await encodeGrantRole(core, executorRole, adminPauseMarket)),
    ...(await encodeGrantRole(core, pauseMarketRole, adminPauseMarket)),
    ...(await encodeAddressToFunctionSelectorForRole(
      core,
      pauseMarketRole,
      dolomiteMargin,
      dolomiteMargin.interface.getFunction('ownerSetPriceOracle'),
    )),
  );
  if (!(await adminPauseMarket.trustedCallers(core.gnosisSafeAddress))) {
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { adminPauseMarket },
      'adminPauseMarket',
      'ownerSetTrustedCaller',
      [core.gnosisSafeAddress, true],
    );
  }
}

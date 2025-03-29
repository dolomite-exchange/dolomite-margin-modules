import { IDolomiteOwner } from 'packages/base/src/types';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import { setupDolomiteOwnerV2 } from '../../../utils/encoding/dolomite-4626-token-encoder-utils';

export async function encodeDolomiteOwnerMigrations(
  dolomiteOwner: IDolomiteOwner,
  transactions: EncodedTransaction[],
  core: any,
) {
  const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.hhUser1);
  if ((await ownable.owner()) !== dolomiteOwner.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: ownable },
        'dolomiteMargin',
        'transferOwnership',
        [dolomiteOwner.address],
      ),
    );
  }

  transactions.push(...await setupDolomiteOwnerV2(core));
}

import { IDolomiteOwner } from 'packages/base/src/types';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';

export async function encodeDolomiteOwnerMigrations(
  dolomiteOwner: IDolomiteOwner,
  transactions: EncodedTransaction[],
  core: any,
) {
  const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.hhUser1);
  if ((await ownable.owner()) !== dolomiteOwner.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { ownable }, 'ownable', 'transferOwnership', [
        dolomiteOwner.address,
      ]),
    );
  }
}

import {
  RegistryProxy,
} from 'packages/base/src/types';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeDolomiteAccountRegistryMigrations(
  dolomiteAccountRegistryProxy: RegistryProxy,
  dolomiteAccountRegistryImplementationAddress: string,
  transactions: EncodedTransaction[],
  core: any,
) {
  if ((await dolomiteAccountRegistryProxy.implementation()) !== dolomiteAccountRegistryImplementationAddress) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteAccountRegistryProxy },
        'dolomiteAccountRegistryProxy',
        'upgradeTo',
        [dolomiteAccountRegistryImplementationAddress],
      ),
    );
  }
}

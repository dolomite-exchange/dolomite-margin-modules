import {
  RegistryProxy,
} from 'packages/base/src/types';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';

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

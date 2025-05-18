import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../../base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeGenericTraderProxyMigrations<T extends DolomiteNetwork>(
  genericTraderRouterAddress: string,
  transactions: EncodedTransaction[],
  core: CoreProtocolType<T>,
) {
  if (!(await core.genericTraderProxy.isCallerAuthorized(genericTraderRouterAddress))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { genericTraderProxyV2: core.genericTraderProxy },
        'genericTraderProxyV2',
        'setIsCallerAuthorized',
        [genericTraderRouterAddress, true],
      ),
    );
  }
}

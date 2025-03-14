import { IDolomiteAccountRiskOverrideSetter, IDolomiteMarginV2, RegistryProxy } from 'packages/base/src/types';
import { Network } from '../../../../../base/src/utils/no-deps-constants';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeDolomiteAccountRiskOverrideSetterMigrations(
  dolomiteAccountRiskOverrideSetter: IDolomiteAccountRiskOverrideSetter,
  dolomiteAccountRiskOverrideSetterProxy: RegistryProxy,
  dolomiteAccountRiskOverrideSetterImplementationAddress: string,
  transactions: EncodedTransaction[],
  core: any,
) {
  if (
    (await dolomiteAccountRiskOverrideSetterProxy.implementation()) !==
    dolomiteAccountRiskOverrideSetterImplementationAddress
  ) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteAccountRiskOverrideSetterProxy },
        'dolomiteAccountRiskOverrideSetterProxy',
        'upgradeTo',
        [dolomiteAccountRiskOverrideSetterImplementationAddress],
      ),
    );
  }

  if (core.config.network !== Network.ArbitrumOne) {
    const dolomiteMargin = core.dolomiteMargin as IDolomiteMarginV2;
    if (
      (await dolomiteMargin.getDefaultAccountRiskOverrideSetter()) !== dolomiteAccountRiskOverrideSetter.address
    ) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { dolomiteMargin },
          'dolomiteMargin',
          'ownerSetDefaultAccountRiskOverride',
          [dolomiteAccountRiskOverrideSetterProxy.address],
        ),
      );
    }
  }
}

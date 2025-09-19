import { ModularLinearStepFunctionInterestSetter__factory } from 'packages/interest-setters/src/types';
import { IDolomiteMargin, IDolomiteMarginV2 } from '../../../../../base/src/types';
import { SignerWithAddressWithSafety } from '../../../../../base/src/utils/SignerWithAddressWithSafety';
import { deployContractAndSave } from '../../../utils/deploy-utils';

export async function deployInterestSetters(
  dolomiteMargin: IDolomiteMargin | IDolomiteMarginV2,
  hhUser1: SignerWithAddressWithSafety,
) {
  const modularInterestSetterAddress = await deployContractAndSave('ModularLinearStepFunctionInterestSetter', [
    dolomiteMargin.address,
  ]);

  return {
    modularInterestSetter: ModularLinearStepFunctionInterestSetter__factory.connect(
      modularInterestSetterAddress,
      hhUser1,
    ),
  };
}

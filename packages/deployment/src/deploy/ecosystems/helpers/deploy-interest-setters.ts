import { IDolomiteMargin, IDolomiteMarginV2 } from '../../../../../base/src/types';
import { deployContractAndSave } from '../../../utils/deploy-utils';

export async function deployInterestSetters(dolomiteMargin: IDolomiteMargin | IDolomiteMarginV2): Promise<void> {
  await deployContractAndSave('ModularLinearStepFunctionInterestSetter', [dolomiteMargin.address]);
}

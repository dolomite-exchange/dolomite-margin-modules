import {
  DolomiteAccountRiskOverrideSetter__factory,
  IDolomiteAccountRiskOverrideSetter__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../../../base/src/types';
import { getRegistryProxyConstructorParams } from '../../../../../base/src/utils/constructors/dolomite';
import { NetworkType } from '../../../../../base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../../../base/src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin } from '../../../../../base/test/utils/dolomite';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';

export async function deployDolomiteAccountRiskOverrideSetter<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  hhUser1: SignerWithAddressWithSafety,
) {
  const dolomiteAccountRiskOverrideSetterImplementationAddress = await deployContractAndSave(
    'DolomiteAccountRiskOverrideSetter',
    [dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteAccountRiskOverrideSetterImplementation', 1),
    undefined,
  );
  const implementation = DolomiteAccountRiskOverrideSetter__factory.connect(
    dolomiteAccountRiskOverrideSetterImplementationAddress,
    hhUser1,
  );
  const initializationCalldata = await implementation.populateTransaction.initialize();
  const riskOverrideSetterProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      dolomiteAccountRiskOverrideSetterImplementationAddress,
      initializationCalldata.data!,
      dolomiteMargin,
    ),
    'DolomiteAccountRiskOverrideSetterProxy',
  );
  const dolomiteAccountRiskOverrideSetter = IDolomiteAccountRiskOverrideSetter__factory.connect(
    riskOverrideSetterProxyAddress,
    hhUser1,
  );
  const dolomiteAccountRiskOverrideSetterProxy = RegistryProxy__factory.connect(
    riskOverrideSetterProxyAddress,
    hhUser1,
  );
  return {
    dolomiteAccountRiskOverrideSetterImplementationAddress,
    dolomiteAccountRiskOverrideSetter,
    dolomiteAccountRiskOverrideSetterProxy,
  };
}

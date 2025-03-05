import CoreDeployments from '@dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteRegistryImplementation__factory, IDolomiteAccountRegistry,
  IDolomiteRegistry__factory, RegistryProxy,
  RegistryProxy__factory,
} from '../../../../../base/src/types';
import { SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL } from '../../../../../base/src/utils/constants';
import { getRegistryProxyConstructorParams } from '../../../../../base/src/utils/constructors/dolomite';
import { NetworkType } from '../../../../../base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../../../base/src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin } from '../../../../../base/test/utils/dolomite';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';

export async function deployDolomiteRegistry<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  eventEmitterProxyAddress: string,
  dolomiteAccountRegistryProxy: IDolomiteAccountRegistry | RegistryProxy,
  network: NetworkType,
  hhUser1: SignerWithAddressWithSafety,
) {
  const dolomiteRegistryImplementationAddress = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteRegistryImplementation', 1),
  );
  const registryImplementation = DolomiteRegistryImplementation__factory.connect(
    dolomiteRegistryImplementationAddress,
    hhUser1,
  );
  const registryImplementationCalldata = await registryImplementation.populateTransaction.initialize(
    CoreDeployments.GenericTraderProxyV1[network].address,
    CoreDeployments.Expiry[network].address,
    SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    eventEmitterProxyAddress,
    dolomiteAccountRegistryProxy.address,
  );
  const dolomiteRegistryAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      dolomiteRegistryImplementationAddress,
      registryImplementationCalldata.data!,
      dolomiteMargin,
    ),
    'DolomiteRegistryProxy',
  );
  const dolomiteRegistry = IDolomiteRegistry__factory.connect(dolomiteRegistryAddress, hhUser1);
  const dolomiteRegistryProxy = RegistryProxy__factory.connect(dolomiteRegistryAddress, hhUser1);
  return {
    dolomiteRegistryImplementationAddress,
    dolomiteRegistry,
    dolomiteRegistryProxy,
  };
}

import {
  DolomiteAccountRegistry__factory,
  IERC20Metadata__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from 'packages/base/src/types';
import { getRegistryProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';
import { NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin } from 'packages/base/test/utils/dolomite';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';
import ModuleDeployments from '../../deployments.json';

export async function deployDolomiteAccountRegistry<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  signer: SignerWithAddressWithSafety,
  network: T,
): Promise<RegistryProxy> {
  const dolomiteAccountRegistryImplementationAddress = await deployContractAndSave(
    'DolomiteAccountRegistry',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteAccountRegistryImplementation', 1),
  );
  const dolomiteAccountRegistryImplementation = DolomiteAccountRegistry__factory.connect(
    dolomiteAccountRegistryImplementationAddress,
    signer,
  );
  const factories = [] as string[];

  if (!(ModuleDeployments as any)['DolomiteAccountRegistryProxy'][network]) {
    const marketsLength = await dolomiteMargin.getNumMarkets();
    for (let i = 0; i < marketsLength.toNumber(); i++) {
      const tokenAddress = await dolomiteMargin.getMarketTokenAddress(i);
      const name = await IERC20Metadata__factory.connect(tokenAddress, signer).name();
      if (name.startsWith('Dolomite Isolation:') || name.startsWith('Dolomite:')) {
        factories.push(tokenAddress);
      }
    }
  }

  const calldata = await dolomiteAccountRegistryImplementation.populateTransaction.initialize(factories);

  const registryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(dolomiteAccountRegistryImplementation.address, calldata.data!, dolomiteMargin),
    'DolomiteAccountRegistryProxy',
  );
  return RegistryProxy__factory.connect(registryProxyAddress, signer);
}

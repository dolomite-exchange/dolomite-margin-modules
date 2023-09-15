import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import {
  getIsolationModeTraderProxyConstructorParams,
  getRegistryProxyConstructorParams,
} from '../../src/utils/constructors/dolomite';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { CoreProtocol } from './setup';

export async function createRegistryProxy(
  implementationAddress: string,
  initializationCalldata: string,
  core: CoreProtocol,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    getRegistryProxyConstructorParams(implementationAddress, initializationCalldata, core),
  );
}

export async function createDolomiteRegistryImplementation(): Promise<DolomiteRegistryImplementation> {
  return createContractWithAbi(
    DolomiteRegistryImplementation__factory.abi,
    DolomiteRegistryImplementation__factory.bytecode,
    [],
  );
}

export async function createIsolationModeTraderProxy(
  implementationAddress: string,
  initializationCalldata: string,
  core: CoreProtocol,
): Promise<IsolationModeTraderProxy> {
  return createContractWithAbi(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    getIsolationModeTraderProxyConstructorParams(implementationAddress, initializationCalldata, core),
  );
}

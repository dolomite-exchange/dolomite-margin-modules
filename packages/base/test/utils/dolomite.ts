import { address } from '@dolomite-margin/dist/src';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  EventEmitterRegistry__factory,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import {
  getEventEmitterRegistryConstructorParams,
  getIsolationModeTraderProxyConstructorParams,
  getRegistryProxyConstructorParams,
} from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, createContractWithName, LibraryName } from '../../src/utils/dolomite-utils';
import { CoreProtocol } from './setup';
import { BigNumberish } from 'ethers';

export async function createIsolationModeTokenVaultV1ActionsImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithName('IsolationModeTokenVaultV1ActionsImpl', []);
  return { IsolationModeTokenVaultV1ActionsImpl: contract.address };
}

export async function createAsyncIsolationModeUnwrapperTraderImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithName('AsyncIsolationModeUnwrapperTraderImpl', []);
  return { AsyncIsolationModeUnwrapperTraderImpl: contract.address };
}

export async function createAsyncIsolationModeWrapperTraderImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithName('AsyncIsolationModeWrapperTraderImpl', []);
  return { AsyncIsolationModeWrapperTraderImpl: contract.address };
}

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

export async function createEventEmitter(
  core: CoreProtocol,
): Promise<EventEmitterRegistry> {
  const implementation = await createContractWithAbi<EventEmitterRegistry>(
    EventEmitterRegistry__factory.abi,
    EventEmitterRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getEventEmitterRegistryConstructorParams(core, implementation),
  );
  return EventEmitterRegistry__factory.connect(proxy.address, core.hhUser1) as EventEmitterRegistry;
}

export async function setupNewGenericTraderProxy(core: CoreProtocol, marketId: BigNumberish) {
  const implementation = await createDolomiteRegistryImplementation();
  await core.dolomiteRegistryProxy.upgradeTo(implementation.address);

  await core.dolomiteRegistry!.ownerSetGenericTraderProxy(core.genericTraderProxy!.address);
  await core.dolomiteRegistry!
    .ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry!.address);
  await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(
    marketId,
    core.liquidatorProxyV4.address,
  );

  await core.dolomiteMargin.ownerSetGlobalOperator(core.genericTraderProxy!.address, true);
  await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV4.address, true);
}

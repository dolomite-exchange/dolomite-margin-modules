import {
  ARBIsolationModeTokenVaultV1,
  ARBIsolationModeVaultFactory,
  ARBIsolationModeVaultFactory__factory,
  ARBRegistry,
  ARBRegistry__factory,
  IARBIsolationModeVaultFactory,
  IARBRegistry,
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  getARBIsolationModeVaultFactoryConstructorParams,
  getARBRegistryConstructorParams,
  getARBUnwrapperTraderV2ConstructorParams,
  getARBWrapperTraderV2ConstructorParams,
} from '../../../src/utils/constructors/arb';
import { createContractWithAbi, createContractWithLibrary } from '../../../src/utils/dolomite-utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../dolomite';
import { CoreProtocol } from '../setup';

export async function createARBRegistry(core: CoreProtocol): Promise<ARBRegistry> {
  const implementation = await createContractWithAbi<ARBRegistry>(
    ARBRegistry__factory.abi,
    ARBRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getARBRegistryConstructorParams(implementation, core),
  );
  return ARBRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createARBIsolationModeTokenVaultV1(): Promise<ARBIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<ARBIsolationModeTokenVaultV1>(
    'ARBIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createARBIsolationModeVaultFactory(
  arbRegistry: IARBRegistry | ARBRegistry,
  userVaultImplementation: ARBIsolationModeTokenVaultV1,
  core: CoreProtocol,
): Promise<ARBIsolationModeVaultFactory> {
  return createContractWithAbi<ARBIsolationModeVaultFactory>(
    ARBIsolationModeVaultFactory__factory.abi,
    ARBIsolationModeVaultFactory__factory.bytecode,
    getARBIsolationModeVaultFactoryConstructorParams(arbRegistry, userVaultImplementation, core),
  );
}

export async function createARBUnwrapperTraderV2(
  factory: IARBIsolationModeVaultFactory | ARBIsolationModeVaultFactory,
  core: CoreProtocol,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getARBUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createARBWrapperTraderV2(
  factory: IARBIsolationModeVaultFactory | ARBIsolationModeVaultFactory,
  core: CoreProtocol,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getARBWrapperTraderV2ConstructorParams(factory, core),
  );
}

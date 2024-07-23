import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import {
  getMNTIsolationModeVaultFactoryConstructorParams,
  getMNTRegistryConstructorParams,
  getMNTUnwrapperTraderV2ConstructorParams,
  getMNTWrapperTraderV2ConstructorParams,
} from '../src/mnt-constructors';
import {
  IMNTIsolationModeVaultFactory,
  IMNTRegistry,
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeVaultFactory,
  MNTIsolationModeVaultFactory__factory,
  MNTRegistry,
  MNTRegistry__factory,
} from '../src/types';

export async function createMNTRegistry(core: CoreProtocolMantle): Promise<MNTRegistry> {
  const implementation = await createContractWithAbi<MNTRegistry>(
    MNTRegistry__factory.abi,
    MNTRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getMNTRegistryConstructorParams(implementation, core),
  );
  return MNTRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createMNTIsolationModeTokenVaultV1(): Promise<MNTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<MNTIsolationModeTokenVaultV1>('MNTIsolationModeTokenVaultV1', libraries, []);
}

export async function createMNTIsolationModeVaultFactory(
  arbRegistry: IMNTRegistry | MNTRegistry,
  userVaultImplementation: MNTIsolationModeTokenVaultV1,
  core: CoreProtocolMantle,
): Promise<MNTIsolationModeVaultFactory> {
  return createContractWithAbi<MNTIsolationModeVaultFactory>(
    MNTIsolationModeVaultFactory__factory.abi,
    MNTIsolationModeVaultFactory__factory.bytecode,
    getMNTIsolationModeVaultFactoryConstructorParams(arbRegistry, userVaultImplementation, core),
  );
}

export async function createMNTUnwrapperTraderV2(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getMNTUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createMNTWrapperTraderV2(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getMNTWrapperTraderV2ConstructorParams(factory, core),
  );
}

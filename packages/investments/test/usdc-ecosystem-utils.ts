import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IUSDCIsolationModeVaultFactory,
  IUSDCRegistry,
  USDCIsolationModeTokenVaultV1,
  USDCIsolationModeVaultFactory,
  USDCIsolationModeVaultFactory__factory,
  USDCRegistry,
  USDCRegistry__factory
} from '../src/types';
import {
  getUSDCIsolationModeVaultFactoryConstructorParams,
  getUSDCRegistryConstructorParams,
  getUSDCUnwrapperTraderV2ConstructorParams,
  getUSDCWrapperTraderV2ConstructorParams
} from '../src/usdc-constructors';
import { createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';

export async function createUSDCRegistry(core: CoreProtocolArbitrumOne): Promise<USDCRegistry> {
  const implementation = await createContractWithAbi<USDCRegistry>(
    USDCRegistry__factory.abi,
    USDCRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getUSDCRegistryConstructorParams(implementation, core),
  );
  return USDCRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createUSDCIsolationModeTokenVaultV1(): Promise<USDCIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<USDCIsolationModeTokenVaultV1>(
    'USDCIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createUSDCIsolationModeVaultFactory(
  usdcRegistry: IUSDCRegistry | USDCRegistry,
  userVaultImplementation: USDCIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne,
): Promise<USDCIsolationModeVaultFactory> {
  return createContractWithAbi<USDCIsolationModeVaultFactory>(
    USDCIsolationModeVaultFactory__factory.abi,
    USDCIsolationModeVaultFactory__factory.bytecode,
    getUSDCIsolationModeVaultFactoryConstructorParams(usdcRegistry, userVaultImplementation, core),
  );
}

export async function createUSDCUnwrapperTraderV2(
  factory: IUSDCIsolationModeVaultFactory | USDCIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getUSDCUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createUSDCWrapperTraderV2(
  factory: IUSDCIsolationModeVaultFactory | USDCIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getUSDCWrapperTraderV2ConstructorParams(factory, core),
  );
}

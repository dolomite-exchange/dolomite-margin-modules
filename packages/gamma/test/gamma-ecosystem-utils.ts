import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeVaultFactory,
  GammaIsolationModeVaultFactory__factory,
  GammaPoolPriceOracle,
  GammaPoolPriceOracle__factory,
  GammaRegistry,
  GammaRegistry__factory,
  IGammaIsolationModeVaultFactory,
  IGammaPool,
  IGammaRegistry
} from '../src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import {
  getGammaIsolationModeVaultFactoryConstructorParams,
  getGammaRegistryConstructorParams,
  getGammaUnwrapperTraderV2ConstructorParams,
  getGammaWrapperTraderV2ConstructorParams
} from '../src/gamma-constructors';
import { createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';

export async function createGammaRegistry(core: CoreProtocolArbitrumOne): Promise<GammaRegistry> {
  const implementation = await createContractWithAbi<GammaRegistry>(
    GammaRegistry__factory.abi,
    GammaRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGammaRegistryConstructorParams(implementation, core),
  );
  return GammaRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createGammaIsolationModeTokenVaultV1(): Promise<GammaIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GammaIsolationModeTokenVaultV1>(
    'GammaIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGammaIsolationModeVaultFactory(
  gammaRegistry: IGammaRegistry | GammaRegistry,
  gammaPool: IGammaPool,
  userVaultImplementation: GammaIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne,
): Promise<GammaIsolationModeVaultFactory> {
  return createContractWithAbi<GammaIsolationModeVaultFactory>(
    GammaIsolationModeVaultFactory__factory.abi,
    GammaIsolationModeVaultFactory__factory.bytecode,
    getGammaIsolationModeVaultFactoryConstructorParams(gammaRegistry, gammaPool, userVaultImplementation, core),
  );
}

export async function createGammaUnwrapperTraderV2(
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGammaUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createGammaWrapperTraderV2(
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  core: CoreProtocolArbitrumOne,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getGammaWrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createGammaPoolPriceOracle(
  core: CoreProtocolArbitrumOne,
  registry: IGammaRegistry | GammaRegistry,
): Promise<GammaPoolPriceOracle> {
  return createContractWithAbi<GammaPoolPriceOracle>(
    GammaPoolPriceOracle__factory.abi,
    GammaPoolPriceOracle__factory.bytecode,
    [
      registry.address,
      core.dolomiteMargin.address,
    ],
  );
}

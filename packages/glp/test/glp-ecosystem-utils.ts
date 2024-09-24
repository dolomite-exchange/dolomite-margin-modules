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
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  getGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPIsolationModeWrapperTraderV2ConstructorParams,
  getGLPPriceOracleV1ConstructorParams,
  getGLPIsolationModeUnwrapperTraderV1ConstructorParams,
  getGLPWrapperTraderV1ConstructorParams,
  getGMXIsolationModeVaultFactoryConstructorParams,
  getGmxRegistryConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
  GmxUserVaultImplementation, getGLPUnwrapperTraderV2ConstructorParams, getGLPWrapperTraderV2ConstructorParams,
} from '../src/glp-constructors';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeUnwrapperTraderV2,
  GLPIsolationModeUnwrapperTraderV2__factory,
  GLPIsolationModeVaultFactory,
  GLPIsolationModeVaultFactory__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV2,
  GLPIsolationModeWrapperTraderV2__factory,
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  GLPUnwrapperTraderV2,
  GLPUnwrapperTraderV2__factory,
  GLPWrapperTraderV2,
  GLPWrapperTraderV2__factory,
  GmxAccountTransferLib,
  GmxAccountTransferLib__factory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeVaultFactory,
  GMXIsolationModeVaultFactory__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IERC20,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  IGmxRegistryV1,
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV2,
  TestGMXIsolationModeTokenVaultV1,
} from '../src/types';

export async function createGmxAccountTransferLib(): Promise<GmxAccountTransferLib> {
  return createContractWithAbi<GmxAccountTransferLib>(
    GmxAccountTransferLib__factory.abi,
    GmxAccountTransferLib__factory.bytecode,
    [],
  );
}

export async function createGLPPriceOracleV1(
  dfsGlpOrFsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPPriceOracleV1> {
  return createContractWithAbi<GLPPriceOracleV1>(
    GLPPriceOracleV1__factory.abi,
    GLPPriceOracleV1__factory.bytecode,
    getGLPPriceOracleV1ConstructorParams(dfsGlpOrFsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeUnwrapperTraderV1(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeUnwrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeUnwrapperTraderV1>(
    GLPIsolationModeUnwrapperTraderV1__factory.abi,
    GLPIsolationModeUnwrapperTraderV1__factory.bytecode,
    getGLPIsolationModeUnwrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<GLPIsolationModeUnwrapperTraderV2>(
    GLPIsolationModeUnwrapperTraderV2__factory.abi,
    GLPIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGLPIsolationModeUnwrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPUnwrapperTraderV2> {
  return createContractWithAbi<GLPUnwrapperTraderV2>(
    GLPUnwrapperTraderV2__factory.abi,
    GLPUnwrapperTraderV2__factory.bytecode,
    getGLPUnwrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeTokenVaultV1(): Promise<GLPIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GLPIsolationModeTokenVaultV1>(
    'GLPIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGLPIsolationModeTokenVaultV2(): Promise<GLPIsolationModeTokenVaultV2> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  const gmxAccountTransferLib = await createGmxAccountTransferLib();
  return createContractWithLibrary<GLPIsolationModeTokenVaultV2>(
    'GLPIsolationModeTokenVaultV2',
    { ...libraries, gmxAccountTransferLib: gmxAccountTransferLib.address },
    [],
  );
}

export async function createTestGLPIsolationModeTokenVaultV1(): Promise<TestGLPIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestGLPIsolationModeTokenVaultV1>(
    'TestGLPIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createTestGLPIsolationModeTokenVaultV2(): Promise<TestGLPIsolationModeTokenVaultV2> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  const gmxAccountTransferLib = await createGmxAccountTransferLib();
  return createContractWithLibrary<TestGLPIsolationModeTokenVaultV2>(
    'TestGLPIsolationModeTokenVaultV2',
    { ...libraries, GmxAccountTransferLib: gmxAccountTransferLib.address },
    [],
  );
}

export async function createGLPIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): Promise<GLPIsolationModeVaultFactory> {
  return createContractWithAbi<GLPIsolationModeVaultFactory>(
    GLPIsolationModeVaultFactory__factory.abi,
    GLPIsolationModeVaultFactory__factory.bytecode,
    getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
}

export async function createGLPIsolationModeWrapperTraderV1(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeWrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeWrapperTraderV1>(
    GLPIsolationModeWrapperTraderV1__factory.abi,
    GLPIsolationModeWrapperTraderV1__factory.bytecode,
    getGLPWrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeWrapperTraderV2> {
  return createContractWithAbi<GLPIsolationModeWrapperTraderV2>(
    GLPIsolationModeWrapperTraderV2__factory.abi,
    GLPIsolationModeWrapperTraderV2__factory.bytecode,
    getGLPIsolationModeWrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  fsGlp: IERC20,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPWrapperTraderV2> {
  return createContractWithAbi<GLPWrapperTraderV2>(
    GLPWrapperTraderV2__factory.abi,
    GLPWrapperTraderV2__factory.bytecode,
    getGLPWrapperTraderV2ConstructorParams(core, fsGlp, gmxRegistry),
  );
}

export async function createGmxRegistry(core: CoreProtocolArbitrumOne): Promise<GmxRegistryV1> {
  const implementation = await createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGmxRegistryConstructorParams(implementation, core),
  );
  return GmxRegistryV1__factory.connect(proxy.address, core.hhUser1);
}

export async function createGMXIsolationModeTokenVaultV1(): Promise<GMXIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GMXIsolationModeTokenVaultV1>(
    'GMXIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createTestGMXIsolationModeTokenVaultV1(): Promise<TestGMXIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestGMXIsolationModeTokenVaultV1>(
    'TestGMXIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGMXIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GMXIsolationModeTokenVaultV1,
): Promise<GMXIsolationModeVaultFactory> {
  return createContractWithAbi<GMXIsolationModeVaultFactory>(
    GMXIsolationModeVaultFactory__factory.abi,
    GMXIsolationModeVaultFactory__factory.bytecode,
    getGMXIsolationModeVaultFactoryConstructorParams(gmxRegistry, userVaultImplementation, core),
  );
}

export async function createGMXUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  factory: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGMXUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createGMXWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  factory: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getGMXWrapperTraderV2ConstructorParams(factory, core),
  );
}

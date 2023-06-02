import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeVaultFactory,
  GLPIsolationModeVaultFactory__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IGLPIsolationModeVaultFactory,
  IGmxRegistryV1,
} from '../../../src/types';
import {
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderConstructorParams,
  getGLPWrapperTraderConstructorParams,
  getGmxRegistryConstructorParams,
  GmxUserVaultImplementation,
} from '../../../src/utils/constructors/gmx';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createGLPPriceOracleV1(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPPriceOracleV1> {
  return createContractWithAbi<GLPPriceOracleV1>(
    GLPPriceOracleV1__factory.abi,
    GLPPriceOracleV1__factory.bytecode,
    getGLPPriceOracleV1ConstructorParams(dfsGlp, gmxRegistry),
  );
}

export async function createGLPUnwrapperTrader(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeUnwrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeUnwrapperTraderV1>(
    GLPIsolationModeUnwrapperTraderV1__factory.abi,
    GLPIsolationModeUnwrapperTraderV1__factory.bytecode,
    getGLPUnwrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeTokenVaultV1(): Promise<GLPIsolationModeTokenVaultV1> {
  return createContractWithAbi<GLPIsolationModeTokenVaultV1>(
    GLPIsolationModeTokenVaultV1__factory.abi,
    GLPIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export async function createGLPIsolationModeVaultFactory(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): Promise<GLPIsolationModeVaultFactory> {
  return createContractWithAbi<GLPIsolationModeVaultFactory>(
    GLPIsolationModeVaultFactory__factory.abi,
    GLPIsolationModeVaultFactory__factory.bytecode,
    getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
}

export async function createGLPWrapperTrader(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeWrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeWrapperTraderV1>(
    GLPIsolationModeWrapperTraderV1__factory.abi,
    GLPIsolationModeWrapperTraderV1__factory.bytecode,
    getGLPWrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export function createGmxRegistry(core: CoreProtocol): Promise<GmxRegistryV1> {
  return createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    getGmxRegistryConstructorParams(core),
  );
}

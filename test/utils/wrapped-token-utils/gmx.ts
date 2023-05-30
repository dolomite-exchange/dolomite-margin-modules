import {
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  GLPUnwrapperTraderV1,
  GLPUnwrapperTraderV1__factory,
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
  GLPWrapperTraderV1,
  GLPWrapperTraderV1__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IGLPWrappedTokenUserVaultFactory,
  IGLPWrappedTokenUserVaultV1,
  IGmxRegistryV1,
  TestGLPWrappedTokenUserVaultV1,
} from '../../../src/types';
import {
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderConstructorParams,
  getGLPWrappedTokenUserVaultFactoryConstructorParams,
  getGLPWrapperTraderConstructorParams,
  getGmxRegistryConstructorParams,
} from '../../../src/utils/constructors/gmx';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createGLPPriceOracleV1(
  dfsGlp: IGLPWrappedTokenUserVaultFactory | GLPWrappedTokenUserVaultFactory,
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
  dfsGlp: IGLPWrappedTokenUserVaultFactory | GLPWrappedTokenUserVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPUnwrapperTraderV1> {
  return createContractWithAbi<GLPUnwrapperTraderV1>(
    GLPUnwrapperTraderV1__factory.abi,
    GLPUnwrapperTraderV1__factory.bytecode,
    getGLPUnwrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPWrappedTokenUserVaultV1(): Promise<GLPWrappedTokenUserVaultV1> {
  return createContractWithAbi<GLPWrappedTokenUserVaultV1>(
    GLPWrappedTokenUserVaultV1__factory.abi,
    GLPWrappedTokenUserVaultV1__factory.bytecode,
    [],
  );
}

export async function createGLPWrappedTokenUserVaultFactory(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: IGLPWrappedTokenUserVaultV1 | GLPWrappedTokenUserVaultV1 | TestGLPWrappedTokenUserVaultV1,
): Promise<GLPWrappedTokenUserVaultFactory> {
  return createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
    GLPWrappedTokenUserVaultFactory__factory.abi,
    GLPWrappedTokenUserVaultFactory__factory.bytecode,
    getGLPWrappedTokenUserVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
}

export async function createGLPWrapperTrader(
  core: CoreProtocol,
  dfsGlp: IGLPWrappedTokenUserVaultFactory | GLPWrappedTokenUserVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPWrapperTraderV1> {
  return createContractWithAbi<GLPWrapperTraderV1>(
    GLPWrapperTraderV1__factory.abi,
    GLPWrapperTraderV1__factory.bytecode,
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

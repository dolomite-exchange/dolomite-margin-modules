import { address } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  IPlutusVaultGLPIsolationModeTokenVaultV1,
  IPlutusVaultRegistry,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  PlutusVaultGLPPriceOracle,
  PlutusVaultGLPPriceOracle__factory,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory,
} from '../../../src/types';
import {
  getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams,
  getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams,
  getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams,
  getPlutusVaultGLPPriceOracleConstructorParams,
  getPlutusVaultRegistryConstructorParams,
} from '../../../src/utils/constructors/plutus';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export function createDolomiteCompatibleWhitelistForPlutusDAO(
  core: CoreProtocol,
  unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  wrapperTrader: PlutusVaultGLPIsolationModeWrapperTraderV1,
  plutusWhitelist: address,
  dplvGlpToken: { address: address },
): Promise<DolomiteCompatibleWhitelistForPlutusDAO> {
  return createContractWithAbi<DolomiteCompatibleWhitelistForPlutusDAO>(
    DolomiteCompatibleWhitelistForPlutusDAO__factory.abi,
    DolomiteCompatibleWhitelistForPlutusDAO__factory.bytecode,
    getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(
      core,
      unwrapperTrader,
      wrapperTrader,
      plutusWhitelist,
      dplvGlpToken,
    ),
  );
}

export function createPlutusVaultGLPIsolationModeVaultFactory(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  plvGlpToken: { address: address },
  userVaultImplementation: IPlutusVaultGLPIsolationModeTokenVaultV1 | PlutusVaultGLPIsolationModeTokenVaultV1,
): Promise<PlutusVaultGLPIsolationModeVaultFactory> {
  return createContractWithAbi<PlutusVaultGLPIsolationModeVaultFactory>(
    PlutusVaultGLPIsolationModeVaultFactory__factory.abi,
    PlutusVaultGLPIsolationModeVaultFactory__factory.bytecode,
    getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams(
      core,
      plutusVaultRegistry,
      plvGlpToken,
      userVaultImplementation,
    ),
  );
}

export function createPlutusVaultGLPIsolationModeTokenVaultV1(): Promise<PlutusVaultGLPIsolationModeTokenVaultV1> {
  return createContractWithAbi(
    PlutusVaultGLPIsolationModeTokenVaultV1__factory.abi,
    PlutusVaultGLPIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createPlutusVaultGLPPriceOracle(
  core: CoreProtocol,
  plutusVaultRegistry: PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  PlutusVaultGLPIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1,
): Promise<PlutusVaultGLPPriceOracle> {
  return createContractWithAbi<PlutusVaultGLPPriceOracle>(
    PlutusVaultGLPPriceOracle__factory.abi,
    PlutusVaultGLPPriceOracle__factory.bytecode,
    getPlutusVaultGLPPriceOracleConstructorParams(
      core,
      plutusVaultRegistry,
      dplvGlpToken,
      PlutusVaultGLPIsolationModeUnwrapperTraderV1,
    ),
  );
}

export function createPlutusVaultGLPIsolationModeUnwrapperTraderV1(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPIsolationModeUnwrapperTraderV1> {
  return createContractWithAbi<PlutusVaultGLPIsolationModeUnwrapperTraderV1>(
    PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.abi,
    PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.bytecode,
    getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

export function createPlutusVaultRegistry(core: CoreProtocol): Promise<PlutusVaultRegistry> {
  return createContractWithAbi<PlutusVaultRegistry>(
    PlutusVaultRegistry__factory.abi,
    PlutusVaultRegistry__factory.bytecode,
    getPlutusVaultRegistryConstructorParams(core),
  );
}

export function createPlutusVaultGLPIsolationModeWrapperTraderV1(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPIsolationModeWrapperTraderV1> {
  return createContractWithAbi<PlutusVaultGLPIsolationModeWrapperTraderV1>(
    PlutusVaultGLPIsolationModeWrapperTraderV1__factory.abi,
    PlutusVaultGLPIsolationModeWrapperTraderV1__factory.bytecode,
    getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

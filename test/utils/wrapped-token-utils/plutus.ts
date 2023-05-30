import { address } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  IPlutusVaultGLPWrappedTokenUserVaultV1,
  IPlutusVaultRegistry,
  PlutusVaultGLPPriceOracle,
  PlutusVaultGLPPriceOracle__factory,
  PlutusVaultGLPUnwrapperTrader,
  PlutusVaultGLPUnwrapperTrader__factory,
  PlutusVaultGLPWrappedTokenUserVaultFactory,
  PlutusVaultGLPWrappedTokenUserVaultFactory__factory,
  PlutusVaultGLPWrappedTokenUserVaultV1,
  PlutusVaultGLPWrappedTokenUserVaultV1__factory,
  PlutusVaultGLPWrapperTrader,
  PlutusVaultGLPWrapperTrader__factory,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory,
} from '../../../src/types';
import {
  getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams,
  getPlutusVaultGLPPriceOracleConstructorParams,
  getPlutusVaultGLPUnwrapperTraderConstructorParams,
  getPlutusVaultGLPWrappedTokenUserVaultFactoryConstructorParams,
  getPlutusVaultGLPWrapperTraderConstructorParams,
  getPlutusVaultRegistryConstructorParams,
} from '../../../src/utils/constructors/plutus';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export function createDolomiteCompatibleWhitelistForPlutusDAO(
  core: CoreProtocol,
  unwrapperTrader: PlutusVaultGLPUnwrapperTrader,
  wrapperTrader: PlutusVaultGLPWrapperTrader,
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

export function createPlutusVaultGLPWrappedTokenUserVaultFactory(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  plvGlpToken: { address: address },
  userVaultImplementation: IPlutusVaultGLPWrappedTokenUserVaultV1 | PlutusVaultGLPWrappedTokenUserVaultV1,
): Promise<PlutusVaultGLPWrappedTokenUserVaultFactory> {
  return createContractWithAbi<PlutusVaultGLPWrappedTokenUserVaultFactory>(
    PlutusVaultGLPWrappedTokenUserVaultFactory__factory.abi,
    PlutusVaultGLPWrappedTokenUserVaultFactory__factory.bytecode,
    getPlutusVaultGLPWrappedTokenUserVaultFactoryConstructorParams(
      core,
      plutusVaultRegistry,
      plvGlpToken,
      userVaultImplementation,
    ),
  );
}

export function createPlutusVaultGLPWrappedTokenUserVaultV1(): Promise<PlutusVaultGLPWrappedTokenUserVaultV1> {
  return createContractWithAbi(
    PlutusVaultGLPWrappedTokenUserVaultV1__factory.abi,
    PlutusVaultGLPWrappedTokenUserVaultV1__factory.bytecode,
    [],
  );
}

export function createPlutusVaultGLPPriceOracle(
  core: CoreProtocol,
  plutusVaultRegistry: PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  plutusVaultGLPUnwrapperTrader: PlutusVaultGLPUnwrapperTrader,
): Promise<PlutusVaultGLPPriceOracle> {
  return createContractWithAbi<PlutusVaultGLPPriceOracle>(
    PlutusVaultGLPPriceOracle__factory.abi,
    PlutusVaultGLPPriceOracle__factory.bytecode,
    getPlutusVaultGLPPriceOracleConstructorParams(
      core,
      plutusVaultRegistry,
      dplvGlpToken,
      plutusVaultGLPUnwrapperTrader,
    ),
  );
}

export function createPlutusVaultGLPUnwrapperTrader(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPUnwrapperTrader> {
  return createContractWithAbi<PlutusVaultGLPUnwrapperTrader>(
    PlutusVaultGLPUnwrapperTrader__factory.abi,
    PlutusVaultGLPUnwrapperTrader__factory.bytecode,
    getPlutusVaultGLPUnwrapperTraderConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

export function createPlutusVaultRegistry(core: CoreProtocol): Promise<PlutusVaultRegistry> {
  return createContractWithAbi<PlutusVaultRegistry>(
    PlutusVaultRegistry__factory.abi,
    PlutusVaultRegistry__factory.bytecode,
    getPlutusVaultRegistryConstructorParams(core),
  );
}

export function createPlutusVaultGLPWrapperTrader(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPWrapperTrader> {
  return createContractWithAbi<PlutusVaultGLPWrapperTrader>(
    PlutusVaultGLPWrapperTrader__factory.abi,
    PlutusVaultGLPWrapperTrader__factory.bytecode,
    getPlutusVaultGLPWrapperTraderConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

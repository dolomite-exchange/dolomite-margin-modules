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
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV2,
  PlutusVaultGLPIsolationModeWrapperTraderV2__factory,
  PlutusVaultGLPPriceOracle,
  PlutusVaultGLPPriceOracle__factory, PlutusVaultGLPPriceOracleChainlink, PlutusVaultGLPPriceOracleChainlink__factory,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory, RegistryProxy, RegistryProxy__factory,
} from '../../../src/types';
import {
  getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams,
  getPlutusVaultGLPIsolationModeUnwrapperTraderV1ConstructorParams,
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeVaultFactoryConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV1ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
  getPlutusVaultGLPPriceOracleConstructorParams,
  getPlutusVaultGLPPriceOracleChainlinkConstructorParams,
  getPlutusVaultRegistryConstructorParams,
} from '../../../src/utils/constructors/plutus';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export function createDolomiteCompatibleWhitelistForPlutusDAO(
  core: CoreProtocol,
  unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  wrapperTrader: PlutusVaultGLPIsolationModeWrapperTraderV1 | PlutusVaultGLPIsolationModeWrapperTraderV2,
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
  unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
): Promise<PlutusVaultGLPPriceOracle> {
  return createContractWithAbi<PlutusVaultGLPPriceOracle>(
    PlutusVaultGLPPriceOracle__factory.abi,
    PlutusVaultGLPPriceOracle__factory.bytecode,
    getPlutusVaultGLPPriceOracleConstructorParams(
      core,
      plutusVaultRegistry,
      dplvGlpToken,
      unwrapper,
    ),
  );
}

export function createPlutusVaultGLPPriceOracleChainlink(
  core: CoreProtocol,
  plutusVaultRegistry: PlutusVaultRegistry,
  dplvGlpToken: { address: address },
  unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  chainlinkRegistry: SignerWithAddress,
): Promise<PlutusVaultGLPPriceOracleChainlink> {
  return createContractWithAbi<PlutusVaultGLPPriceOracleChainlink>(
  PlutusVaultGLPPriceOracleChainlink__factory.abi,
    PlutusVaultGLPPriceOracleChainlink__factory.bytecode,
    getPlutusVaultGLPPriceOracleChainlinkConstructorParams(
      core,
      plutusVaultRegistry,
      dplvGlpToken,
      unwrapper,
      chainlinkRegistry,
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

export function createPlutusVaultGLPIsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<PlutusVaultGLPIsolationModeUnwrapperTraderV2>(
    PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.abi,
    PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.bytecode,
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

export async function createPlutusVaultRegistry(core: CoreProtocol): Promise<PlutusVaultRegistry> {
  const implementation = await createContractWithAbi<PlutusVaultRegistry>(
    PlutusVaultRegistry__factory.abi,
    PlutusVaultRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPlutusVaultRegistryConstructorParams(implementation, core),
  );
  return PlutusVaultRegistry__factory.connect(proxy.address, core.hhUser1);
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

export function createPlutusVaultGLPIsolationModeWrapperTraderV2(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPIsolationModeWrapperTraderV2> {
  return createContractWithAbi<PlutusVaultGLPIsolationModeWrapperTraderV2>(
    PlutusVaultGLPIsolationModeWrapperTraderV2__factory.abi,
    PlutusVaultGLPIsolationModeWrapperTraderV2__factory.bytecode,
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(core, plutusVaultRegistry, dPlvGlpToken),
  );
}

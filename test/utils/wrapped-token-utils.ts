import { address } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  GLPUnwrapperTraderV1,
  GLPUnwrapperTraderV1__factory,
  GLPWrapperTraderV1,
  GLPWrapperTraderV1__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
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
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
} from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { CoreProtocol } from './setup';

export async function createTestWrappedTokenFactory(
  core: CoreProtocol,
  underlyingToken: { address: address },
  userVaultImplementation: { address: address },
): Promise<TestWrappedTokenUserVaultFactory> {
  return await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
    TestWrappedTokenUserVaultFactory__factory.abi,
    TestWrappedTokenUserVaultFactory__factory.bytecode,
    [
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export function getGlpUnwrapperTraderConstructorParams(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function createGlpUnwrapperTrader(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPUnwrapperTraderV1> {
  return createContractWithAbi<GLPUnwrapperTraderV1>(
    GLPUnwrapperTraderV1__factory.abi,
    GLPUnwrapperTraderV1__factory.bytecode,
    getGlpUnwrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export function getGlpWrapperTraderConstructorParams(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function createGlpWrapperTrader(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPWrapperTraderV1> {
  return createContractWithAbi<GLPWrapperTraderV1>(
    GLPWrapperTraderV1__factory.abi,
    GLPWrapperTraderV1__factory.bytecode,
    getGlpWrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export function getGmxRegistryConstructorParams(core: CoreProtocol): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

  return [
    {
      esGmx: core.gmxEcosystem.esGmx.address,
      fsGlp: core.gmxEcosystem.fsGlp.address,
      glp: core.gmxEcosystem.glp.address,
      glpManager: core.gmxEcosystem.glpManager.address,
      glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
      gmx: core.gmxEcosystem.gmx.address,
      gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
      gmxVault: core.gmxEcosystem.gmxVault.address,
      sGlp: core.gmxEcosystem.sGlp.address,
      sGmx: core.gmxEcosystem.sGmx.address,
      sbfGmx: core.gmxEcosystem.sbfGmx.address,
      vGlp: core.gmxEcosystem.vGlp.address,
      vGmx: core.gmxEcosystem.vGmx.address,
    },
    core.dolomiteMargin.address,
  ];
}

export function createGmxRegistry(core: CoreProtocol): Promise<GmxRegistryV1> {
  return createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    getGmxRegistryConstructorParams(core),
  );
}

// ====================== Plutus ======================

export function getPlutusVaultRegistryConstructorParams(core: CoreProtocol): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.plutusEcosystem.plsToken.address,
    core.plutusEcosystem.plvGlp.address,
    core.plutusEcosystem.plvGlpRouter.address,
    core.plutusEcosystem.plvGlpFarm.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPPriceOracleConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
  plutusVaultGLPUnwrapperTrader: PlutusVaultGLPUnwrapperTrader,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.dolomiteMargin.address,
    core.marketIds.dfsGlp!,
    dPlvGlpToken.address,
    plutusVaultRegistry.address,
    plutusVaultGLPUnwrapperTrader.address,
  ];
}

export function getPlutusVaultGLPUnwrapperTraderConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.usdc.address,
    core.gmxRegistry!.address,
    plutusVaultRegistry.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getDolomiteCompatibleWhitelistForPlutusDAOConstructorParams(
  core: CoreProtocol,
  unwrapperTrader: PlutusVaultGLPUnwrapperTrader,
  wrapperTrader: PlutusVaultGLPWrapperTrader,
  plutusWhitelist: address,
  dplvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    unwrapperTrader.address,
    wrapperTrader.address,
    plutusWhitelist,
    dplvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPWrappedTokenUserVaultFactoryConstructorParams(
  core: CoreProtocol,
  plutusVaultRegistry: IPlutusVaultRegistry | PlutusVaultRegistry,
  plvGlpToken: { address: address },
  userVaultImplementation: IPlutusVaultGLPWrappedTokenUserVaultV1 | PlutusVaultGLPWrappedTokenUserVaultV1,
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    plutusVaultRegistry.address,
    plvGlpToken.address,
    core.borrowPositionProxyV2.address,
    userVaultImplementation.address,
    core.dolomiteMargin.address,
  ];
}

export function getPlutusVaultGLPWrapperTraderConstructorParams(
  core: CoreProtocol,
  dPlvGlpToken: { address: address },
): any[] {
  if (!core.plutusEcosystem) {
    throw new Error('Plutus ecosystem not initialized');
  }

  return [
    core.gmxRegistry!.address,
    dPlvGlpToken.address,
    core.dolomiteMargin.address,
  ];
}

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
  dPlvGlpToken: { address: address },
  plutusVaultGLPUnwrapperTrader: PlutusVaultGLPUnwrapperTrader,
): Promise<PlutusVaultGLPPriceOracle> {
  return createContractWithAbi<PlutusVaultGLPPriceOracle>(
    PlutusVaultGLPPriceOracle__factory.abi,
    PlutusVaultGLPPriceOracle__factory.bytecode,
    getPlutusVaultGLPPriceOracleConstructorParams(
      core,
      plutusVaultRegistry,
      dPlvGlpToken,
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
  dPlvGlpToken: { address: address },
): Promise<PlutusVaultGLPWrapperTrader> {
  return createContractWithAbi<PlutusVaultGLPWrapperTrader>(
    PlutusVaultGLPWrapperTrader__factory.abi,
    PlutusVaultGLPWrapperTrader__factory.bytecode,
    getPlutusVaultGLPWrapperTraderConstructorParams(core, dPlvGlpToken),
  );
}

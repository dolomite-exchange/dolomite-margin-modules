import { BigNumberish } from 'ethers';
import {
  IERC20,
  IPendleGLPRegistry,
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendlePtIsolationModeTokenVaultV1,
  IPendlePtIsolationModeVaultFactory,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleRegistry,
  IPendleSyToken,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeVaultFactory,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleGLPRegistry__factory,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPPriceOracle__factory,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeUnwrapperTraderV2__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtIsolationModeWrapperTraderV2__factory,
  PendlePtPriceOracle,
  PendlePtPriceOracle__factory,
  PendleRegistry,
  PendleRegistry__factory,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory__factory,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  PendleYtGLP2024IsolationModeWrapperTraderV2__factory,
  PendleYtGLPPriceOracle,
  PendleYtGLPPriceOracle__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  getPendleGLPRegistryConstructorParams,
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtPriceOracleConstructorParams,
  getPendleRegistryConstructorParams,
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import { createContractWithAbi, createContractWithLibrary } from '../../../packages/base/src/utils/dolomite-utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../../../packages/base/test/utils/dolomite';
import { CoreProtocol } from '../../../packages/base/test/utils/setup';

export async function createPendleGLPRegistry(core: CoreProtocol): Promise<PendleGLPRegistry> {
  const implementation = await createContractWithAbi<PendleGLPRegistry>(
    PendleGLPRegistry__factory.abi,
    PendleGLPRegistry__factory.bytecode,
    [],
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPendleGLPRegistryConstructorParams(implementation, core),
  );

  return PendleGLPRegistry__factory.connect(registry.address, core.hhUser1);
}

export async function createPendleRegistry(
  core: CoreProtocol,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  syToken: IPendleSyToken,
): Promise<PendleRegistry> {
  const implementation = await createContractWithAbi<PendleRegistry>(
    PendleRegistry__factory.abi,
    PendleRegistry__factory.bytecode,
    [],
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPendleRegistryConstructorParams(implementation, core, ptMarket, ptOracle, syToken),
  );

  return PendleRegistry__factory.connect(registry.address, core.hhUser1);
}

export async function createPendlePtIsolationModeTokenVaultV1(): Promise<PendlePtIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<PendlePtIsolationModeTokenVaultV1>(
    'PendlePtIsolationModeTokenVaultV1',
    { ...libraries },
    [],
  );
}

export function createPendlePtIsolationModeVaultFactory(
  core: CoreProtocol,
  registry: IPendleRegistry | PendleRegistry,
  ptToken: IPendlePtToken,
  userVaultImplementation: IPendlePtIsolationModeTokenVaultV1 | PendlePtIsolationModeTokenVaultV1,
): Promise<PendlePtIsolationModeVaultFactory> {
  return createContractWithAbi(
    PendlePtIsolationModeVaultFactory__factory.abi,
    PendlePtIsolationModeVaultFactory__factory.bytecode,
    getPendlePtIsolationModeVaultFactoryConstructorParams(
      core,
      registry,
      ptToken,
      userVaultImplementation,
    ),
  );
}

export function createPendlePtIsolationModeWrapperTraderV2(
  core: CoreProtocol,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): Promise<PendlePtIsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendlePtIsolationModeWrapperTraderV2__factory.abi,
    PendlePtIsolationModeWrapperTraderV2__factory.bytecode,
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(core, pendleRegistry, underlyingToken, dptToken),
  );
}

export function createPendlePtIsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): Promise<PendlePtIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendlePtIsolationModeUnwrapperTraderV2__factory.abi,
    PendlePtIsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(core, pendleRegistry, underlyingToken, dptToken),
  );
}

export function createPendlePtPriceOracle(
  core: CoreProtocol,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
): Promise<PendlePtPriceOracle> {
  return createContractWithAbi(
    PendlePtPriceOracle__factory.abi,
    PendlePtPriceOracle__factory.bytecode,
    getPendlePtPriceOracleConstructorParams(core, dptToken, pendleRegistry, underlyingToken),
  );
}

export async function createPendlePtGLP2024IsolationModeTokenVaultV1(
): Promise<PendlePtGLP2024IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<PendlePtGLP2024IsolationModeTokenVaultV1>(
    'PendlePtGLP2024IsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export function createPendlePtGLPPriceOracle(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLPPriceOracle> {
  return createContractWithAbi(
    PendlePtGLPPriceOracle__factory.abi,
    PendlePtGLPPriceOracle__factory.bytecode,
    getPendlePtGLPPriceOracleConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLP2024IsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLP2024IsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.abi,
    PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLP2024IsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024IsolationModeVaultFactory | PendlePtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLP2024IsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendlePtGLP2024IsolationModeWrapperTraderV2__factory.abi,
    PendlePtGLP2024IsolationModeWrapperTraderV2__factory.bytecode,
    getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLP2024IsolationModeVaultFactory(
  core: CoreProtocol,
  registry: IPendleGLPRegistry | PendleGLPRegistry,
  ptGlpToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLP2024IsolationModeTokenVaultV1 | PendlePtGLP2024IsolationModeTokenVaultV1,
): Promise<PendlePtGLP2024IsolationModeVaultFactory> {
  return createContractWithAbi<PendlePtGLP2024IsolationModeVaultFactory>(
    PendlePtGLP2024IsolationModeVaultFactory__factory.abi,
    PendlePtGLP2024IsolationModeVaultFactory__factory.bytecode,
    getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams(
      core,
      registry,
      ptGlpToken,
      userVaultImplementation,
    ),
  );
}

export async function createPendleYtGLP2024IsolationModeTokenVaultV1(
): Promise<PendleYtGLP2024IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary(
    'PendleYtGLP2024IsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export function createPendleYtGLP2024IsolationModeVaultFactory(
  core: CoreProtocol,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLP2024IsolationModeTokenVaultV1 | PendleYtGLP2024IsolationModeTokenVaultV1,
): Promise<PendleYtGLP2024IsolationModeVaultFactory> {
  return createContractWithAbi<PendleYtGLP2024IsolationModeVaultFactory>(
    PendleYtGLP2024IsolationModeVaultFactory__factory.abi,
    PendleYtGLP2024IsolationModeVaultFactory__factory.bytecode,
    getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams(
      core,
      pendleRegistry,
      debtMarketIds,
      collateralMarketIds,
      ytGlpToken,
      userVaultImplementation,
    ),
  );
}

export function createPendleYtGLP2024IsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLP2024IsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory.abi,
    PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dytGlp, pendleRegistry),
  );
}

export function createPendleYtGLP2024IsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLP2024IsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendleYtGLP2024IsolationModeWrapperTraderV2__factory.abi,
    PendleYtGLP2024IsolationModeWrapperTraderV2__factory.bytecode,
    getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(core, dytGlp, pendleRegistry),
  );
}

export function createPendleYtGLPPriceOracle(
  core: CoreProtocol,
  dytGlp: IPendleYtGLP2024IsolationModeVaultFactory | PendleYtGLP2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLPPriceOracle> {
  return createContractWithAbi(
    PendleYtGLPPriceOracle__factory.abi,
    PendleYtGLPPriceOracle__factory.bytecode,
    getPendleYtGLPPriceOracleConstructorParams(core, dytGlp, pendleRegistry),
  );
}

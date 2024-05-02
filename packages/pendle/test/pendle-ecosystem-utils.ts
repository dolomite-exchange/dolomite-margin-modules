import { RegistryProxy, RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { BigNumberish } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  CoreProtocolWithPendle,
  getPendleGLPRegistryConstructorParams,
  getPendlePtEEthPriceOracleConstructorParams,
  getPendlePtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLPMar2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV3ConstructorParams,
  getPendlePtPriceOracleConstructorParams,
  getPendlePtPriceOracleV2ConstructorParams,
  getPendlePtRsEthPriceOracleConstructorParams,
  getPendleRegistryConstructorParams,
  getPendleYtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLPMar2024IsolationModeVaultFactoryConstructorParams,
  getPendleYtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLPPriceOracleConstructorParams,
  getPendleYtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtIsolationModeVaultFactoryConstructorParams,
  getPendleYtIsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtPriceOracleConstructorParams,
} from '../src/pendle-constructors';
import {
  IERC20,
  IPendleGLPRegistry,
  IPendlePtGLPMar2024IsolationModeTokenVaultV1,
  IPendlePtGLPMar2024IsolationModeVaultFactory,
  IPendlePtIsolationModeTokenVaultV1,
  IPendlePtIsolationModeVaultFactory,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleRegistry,
  IPendleSyToken,
  IPendleYtGLPMar2024IsolationModeTokenVaultV1,
  IPendleYtGLPMar2024IsolationModeVaultFactory,
  IPendleYtIsolationModeTokenVaultV1,
  IPendleYtIsolationModeVaultFactory,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleGLPRegistry__factory,
  PendlePtEEthPriceOracle,
  PendlePtEEthPriceOracle__factory,
  PendlePtGLPMar2024IsolationModeTokenVaultV1,
  PendlePtGLPMar2024IsolationModeUnwrapperTraderV2,
  PendlePtGLPMar2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PendlePtGLPMar2024IsolationModeVaultFactory__factory,
  PendlePtGLPMar2024IsolationModeWrapperTraderV2,
  PendlePtGLPMar2024IsolationModeWrapperTraderV2__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPPriceOracle__factory,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeUnwrapperTraderV2__factory,
  PendlePtIsolationModeUnwrapperTraderV3,
  PendlePtIsolationModeUnwrapperTraderV3__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtIsolationModeWrapperTraderV2__factory,
  PendlePtIsolationModeWrapperTraderV3,
  PendlePtIsolationModeWrapperTraderV3__factory,
  PendlePtPriceOracle,
  PendlePtPriceOracle__factory,
  PendlePtPriceOracleV2,
  PendlePtPriceOracleV2__factory,
  PendlePtRsEthPriceOracle,
  PendlePtRsEthPriceOracle__factory,
  PendleRegistry,
  PendleRegistry__factory,
  PendleYtGLPMar2024IsolationModeTokenVaultV1,
  PendleYtGLPMar2024IsolationModeUnwrapperTraderV2,
  PendleYtGLPMar2024IsolationModeUnwrapperTraderV2__factory,
  PendleYtGLPMar2024IsolationModeVaultFactory,
  PendleYtGLPMar2024IsolationModeVaultFactory__factory,
  PendleYtGLPMar2024IsolationModeWrapperTraderV2,
  PendleYtGLPMar2024IsolationModeWrapperTraderV2__factory,
  PendleYtGLPPriceOracle,
  PendleYtGLPPriceOracle__factory,
  PendleYtIsolationModeTokenVaultV1,
  PendleYtIsolationModeUnwrapperTraderV2,
  PendleYtIsolationModeUnwrapperTraderV2__factory,
  PendleYtIsolationModeVaultFactory,
  PendleYtIsolationModeVaultFactory__factory,
  PendleYtIsolationModeWrapperTraderV2,
  PendleYtIsolationModeWrapperTraderV2__factory,
  PendleYtPriceOracle,
  PendleYtPriceOracle__factory,
  TestPendleYtGLPMar2024IsolationModeTokenVaultV1,
} from '../src/types';

export async function createPendleGLPRegistry(core: CoreProtocolArbitrumOne): Promise<PendleGLPRegistry> {
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

export async function createPendleRegistry<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export async function createPendleYtIsolationModeTokenVaultV1(): Promise<PendleYtIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<PendleYtIsolationModeTokenVaultV1>(
    'PendleYtIsolationModeTokenVaultV1',
    { ...libraries },
    [],
  );
}

export function createPendlePtIsolationModeVaultFactory<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function createPendleYtIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytToken: IPendleYtToken,
  userVaultImplementation: IPendleYtIsolationModeTokenVaultV1 | PendleYtIsolationModeTokenVaultV1,
): Promise<PendleYtIsolationModeVaultFactory> {
  return createContractWithAbi<PendleYtIsolationModeVaultFactory>(
    PendleYtIsolationModeVaultFactory__factory.abi,
    PendleYtIsolationModeVaultFactory__factory.bytecode,
    getPendleYtIsolationModeVaultFactoryConstructorParams(
      core,
      pendleRegistry,
      debtMarketIds,
      collateralMarketIds,
      ytToken,
      userVaultImplementation,
    ),
  );
}

export function createPendlePtIsolationModeWrapperTraderV2<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function createPendlePtIsolationModeWrapperTraderV3<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): Promise<PendlePtIsolationModeWrapperTraderV3> {
  return createContractWithAbi(
    PendlePtIsolationModeWrapperTraderV3__factory.abi,
    PendlePtIsolationModeWrapperTraderV3__factory.bytecode,
    getPendlePtIsolationModeWrapperTraderV3ConstructorParams(core, pendleRegistry, underlyingToken, dptToken),
  );
}

export function createPendlePtIsolationModeUnwrapperTraderV2<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function createPendleYtIsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  underlyingToken: IERC20,
  dytToken: IPendleYtIsolationModeVaultFactory | PendleYtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): Promise<PendleYtIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendleYtIsolationModeUnwrapperTraderV2__factory.abi,
    PendleYtIsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendleYtIsolationModeUnwrapperTraderV2ConstructorParams(core, underlyingToken, pendleRegistry, dytToken),
  );
}

export function createPendleYtIsolationModeWrapperTraderV2<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  underlyingToken: IERC20,
  dytToken: IPendleYtIsolationModeVaultFactory | PendleYtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): Promise<PendleYtIsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendleYtIsolationModeWrapperTraderV2__factory.abi,
    PendleYtIsolationModeWrapperTraderV2__factory.bytecode,
    getPendleYtIsolationModeWrapperTraderV2ConstructorParams(core, underlyingToken, pendleRegistry, dytToken),
  );
}

export function createPendlePtIsolationModeUnwrapperTraderV3<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
): Promise<PendlePtIsolationModeUnwrapperTraderV3> {
  return createContractWithAbi(
    PendlePtIsolationModeUnwrapperTraderV3__factory.abi,
    PendlePtIsolationModeUnwrapperTraderV3__factory.bytecode,
    getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams(core, pendleRegistry, underlyingToken, dptToken),
  );
}

export function createPendleYtPriceOracle(
  core: CoreProtocolArbitrumOne,
  dytToken: IPendleYtIsolationModeVaultFactory | PendleYtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
  underlyingToken: IERC20,
): Promise<PendleYtPriceOracle> {
  return createContractWithAbi(
    PendleYtPriceOracle__factory.abi,
    PendleYtPriceOracle__factory.bytecode,
    getPendleYtPriceOracleConstructorParams(core, dytToken, pendleRegistry, underlyingToken),
  );
}

export function createPendlePtPriceOracle<T extends Network>(
  core: CoreProtocolWithPendle<T>,
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

export function createPendlePtPriceOracleV2<T extends Network>(
  core: CoreProtocolWithPendle<T>,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): Promise<PendlePtPriceOracleV2> {
  return createContractWithAbi(
    PendlePtPriceOracleV2__factory.abi,
    PendlePtPriceOracleV2__factory.bytecode,
    getPendlePtPriceOracleV2ConstructorParams(core, dptToken, pendleRegistry),
  );
}

export async function createPendlePtGLPMar2024IsolationModeTokenVaultV1(
): Promise<PendlePtGLPMar2024IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<PendlePtGLPMar2024IsolationModeTokenVaultV1>(
    'PendlePtGLPMar2024IsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export function createPendlePtGLPPriceOracle(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLPPriceOracle> {
  return createContractWithAbi(
    PendlePtGLPPriceOracle__factory.abi,
    PendlePtGLPPriceOracle__factory.bytecode,
    getPendlePtGLPPriceOracleConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLPMar2024IsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLPMar2024IsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendlePtGLPMar2024IsolationModeUnwrapperTraderV2__factory.abi,
    PendlePtGLPMar2024IsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendlePtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLPMar2024IsolationModeWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dptGlp: IPendlePtGLPMar2024IsolationModeVaultFactory | PendlePtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendlePtGLPMar2024IsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendlePtGLPMar2024IsolationModeWrapperTraderV2__factory.abi,
    PendlePtGLPMar2024IsolationModeWrapperTraderV2__factory.bytecode,
    getPendlePtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLPMar2024IsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  registry: IPendleGLPRegistry | PendleGLPRegistry,
  ptGlpToken: IPendlePtToken,
  userVaultImplementation: IPendlePtGLPMar2024IsolationModeTokenVaultV1 | PendlePtGLPMar2024IsolationModeTokenVaultV1,
): Promise<PendlePtGLPMar2024IsolationModeVaultFactory> {
  return createContractWithAbi<PendlePtGLPMar2024IsolationModeVaultFactory>(
    PendlePtGLPMar2024IsolationModeVaultFactory__factory.abi,
    PendlePtGLPMar2024IsolationModeVaultFactory__factory.bytecode,
    getPendlePtGLPMar2024IsolationModeVaultFactoryConstructorParams(
      core,
      registry,
      ptGlpToken,
      userVaultImplementation,
    ),
  );
}

export async function createPendleYtGLPMar2024IsolationModeTokenVaultV1(
): Promise<PendleYtGLPMar2024IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary(
    'PendleYtGLPMar2024IsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createTestPendleYtGLPMar2024IsolationModeTokenVaultV1(
): Promise<TestPendleYtGLPMar2024IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary(
    'TestPendleYtGLPMar2024IsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export function createPendleYtGLPMar2024IsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLPMar2024IsolationModeTokenVaultV1 | PendleYtGLPMar2024IsolationModeTokenVaultV1,
): Promise<PendleYtGLPMar2024IsolationModeVaultFactory> {
  return createContractWithAbi<PendleYtGLPMar2024IsolationModeVaultFactory>(
    PendleYtGLPMar2024IsolationModeVaultFactory__factory.abi,
    PendleYtGLPMar2024IsolationModeVaultFactory__factory.bytecode,
    getPendleYtGLPMar2024IsolationModeVaultFactoryConstructorParams(
      core,
      pendleRegistry,
      debtMarketIds,
      collateralMarketIds,
      ytGlpToken,
      userVaultImplementation,
    ),
  );
}

export function createPendleYtGLPMar2024IsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLPMar2024IsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendleYtGLPMar2024IsolationModeUnwrapperTraderV2__factory.abi,
    PendleYtGLPMar2024IsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendleYtGLPMar2024IsolationModeUnwrapperTraderV2ConstructorParams(core, dytGlp, pendleRegistry),
  );
}

export function createPendleYtGLPMar2024IsolationModeWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLPMar2024IsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendleYtGLPMar2024IsolationModeWrapperTraderV2__factory.abi,
    PendleYtGLPMar2024IsolationModeWrapperTraderV2__factory.bytecode,
    getPendleYtGLPMar2024IsolationModeWrapperTraderV2ConstructorParams(core, dytGlp, pendleRegistry),
  );
}

export function createPendleYtGLPPriceOracle(
  core: CoreProtocolArbitrumOne,
  dytGlp: IPendleYtGLPMar2024IsolationModeVaultFactory | PendleYtGLPMar2024IsolationModeVaultFactory,
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
): Promise<PendleYtGLPPriceOracle> {
  return createContractWithAbi(
    PendleYtGLPPriceOracle__factory.abi,
    PendleYtGLPPriceOracle__factory.bytecode,
    getPendleYtGLPPriceOracleConstructorParams(core, dytGlp, pendleRegistry),
  );
}

export function createPendlePtRsEthPriceOracle(
  core: CoreProtocolArbitrumOne,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): Promise<PendlePtRsEthPriceOracle> {
  return createContractWithAbi(
    PendlePtRsEthPriceOracle__factory.abi,
    PendlePtRsEthPriceOracle__factory.bytecode,
    getPendlePtRsEthPriceOracleConstructorParams(core, dptToken, pendleRegistry),
  );
}

export function createPendlePtEEthPriceOracle(
  core: CoreProtocolArbitrumOne,
  dptToken: IPendlePtIsolationModeVaultFactory | PendlePtIsolationModeVaultFactory,
  pendleRegistry: IPendleRegistry | PendleRegistry,
): Promise<PendlePtEEthPriceOracle> {
  return createContractWithAbi(
    PendlePtEEthPriceOracle__factory.abi,
    PendlePtEEthPriceOracle__factory.bytecode,
    getPendlePtEEthPriceOracleConstructorParams(core, dptToken, pendleRegistry),
  );
}

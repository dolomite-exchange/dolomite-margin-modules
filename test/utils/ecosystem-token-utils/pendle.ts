import {
  RegistryProxy,
  RegistryProxy__factory,
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendleGLPRegistry,
  IPendlePtToken,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
  PendleGLPRegistry,
  PendleGLPRegistry__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPPriceOracle__factory,
} from '../../../src/types';
import {
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendleGLPRegistryConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createPendleGLPRegistry(core: CoreProtocol): Promise<PendleGLPRegistry> {
  const implementation = await createContractWithAbi<PendleGLPRegistry>(
    PendleGLPRegistry__factory.abi,
    PendleGLPRegistry__factory.bytecode,
    []
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPendleGLPRegistryConstructorParams(core, implementation),
  );

  return PendleGLPRegistry__factory.connect(registry.address, core.hhUser1);
}

export function createPendlePtGLP2024IsolationModeTokenVaultV1(): Promise<PendlePtGLP2024IsolationModeTokenVaultV1> {
  return createContractWithAbi(
    PendlePtGLP2024IsolationModeTokenVaultV1__factory.abi,
    PendlePtGLP2024IsolationModeTokenVaultV1__factory.bytecode,
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

import { BigNumberish } from 'ethers';
import {
  RegistryProxy,
  RegistryProxy__factory,
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendleGLPRegistry,
  IPendlePtToken,
  IPendleYtToken,
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
  PendleYtGLPPriceOracle,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  IPendleYtGLP2024IsolationModeVaultFactory__factory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory__factory,
  IPendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendleYtGLPPriceOracle__factory,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  PendleYtGLP2024IsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  getPendleGLPRegistryConstructorParams,
  getPendlePtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendlePtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
  getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLPPriceOracleConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
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

export function createPendleYtGLP2024IsolationModeTokenVaultV1(): Promise<PendleYtGLP2024IsolationModeTokenVaultV1> {
  return createContractWithAbi(
    PendleYtGLP2024IsolationModeTokenVaultV1__factory.abi,
    PendleYtGLP2024IsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createPendleYtGLP2024IsolationModeVaultFactory(
  pendleRegistry: IPendleGLPRegistry | PendleGLPRegistry,
  debtMarketIds: Array<Number>,
  collateralMarketIds: Array<Number>,
  core: CoreProtocol,
  ytGlpToken: IPendleYtToken,
  userVaultImplementation: IPendleYtGLP2024IsolationModeTokenVaultV1 | PendleYtGLP2024IsolationModeTokenVaultV1,
): Promise<PendleYtGLP2024IsolationModeVaultFactory> {
  return createContractWithAbi<PendleYtGLP2024IsolationModeVaultFactory>(
    PendleYtGLP2024IsolationModeVaultFactory__factory.abi,
    PendleYtGLP2024IsolationModeVaultFactory__factory.bytecode,
    getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams(
      pendleRegistry,
      debtMarketIds,
      collateralMarketIds,
      core,
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

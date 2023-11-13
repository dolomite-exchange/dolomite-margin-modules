import { BigNumberish } from 'ethers';
import {
  IPendleGLPRegistry,
  IPendlePtGLP2024IsolationModeTokenVaultV1,
  IPendlePtGLP2024IsolationModeVaultFactory,
  IPendlePtRETHIsolationModeTokenVaultV1,
  IPendlePtRETHIsolationModeVaultFactory,
  IPendlePtToken,
  IPendlePtWstETHIsolationModeTokenVaultV1,
  IPendlePtWstETHIsolationModeVaultFactory,
  IPendleRETHRegistry,
  IPendleWstETHRegistry,
  IPendleYtGLP2024IsolationModeTokenVaultV1,
  IPendleYtGLP2024IsolationModeVaultFactory,
  IPendleYtToken,
  PendleGLPRegistry,
  PendleGLPRegistry__factory,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPPriceOracle__factory,
  PendlePtRETHIsolationModeTokenVaultV1,
  PendlePtRETHIsolationModeTokenVaultV1__factory,
  PendlePtRETHIsolationModeUnwrapperTraderV2,
  PendlePtRETHIsolationModeUnwrapperTraderV2__factory,
  PendlePtRETHIsolationModeVaultFactory,
  PendlePtRETHIsolationModeVaultFactory__factory,
  PendlePtRETHIsolationModeWrapperTraderV2,
  PendlePtRETHIsolationModeWrapperTraderV2__factory,
  PendlePtRETHPriceOracle,
  PendlePtRETHPriceOracle__factory,
  PendlePtWstETHIsolationModeTokenVaultV1,
  PendlePtWstETHIsolationModeTokenVaultV1__factory,
  PendlePtWstETHIsolationModeUnwrapperTraderV2,
  PendlePtWstETHIsolationModeUnwrapperTraderV2__factory,
  PendlePtWstETHIsolationModeVaultFactory,
  PendlePtWstETHIsolationModeVaultFactory__factory,
  PendlePtWstETHIsolationModeWrapperTraderV2,
  PendlePtWstETHIsolationModeWrapperTraderV2__factory,
  PendlePtWstETHPriceOracle,
  PendlePtWstETHPriceOracle__factory,
  PendleRETHRegistry,
  PendleRETHRegistry__factory,
  PendleWstETHRegistry,
  PendleWstETHRegistry__factory,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
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
  getPendlePtRETHIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtRETHIsolationModeVaultFactoryConstructorParams,
  getPendlePtRETHIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtRETHPriceOracleConstructorParams,
  getPendlePtWstETHIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtWstETHIsolationModeVaultFactoryConstructorParams,
  getPendlePtWstETHIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtWstETHPriceOracleConstructorParams,
  getPendleRETHRegistryConstructorParams,
  getPendleWstETHRegistryConstructorParams,
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

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

export async function createPendleWstETHRegistry(core: CoreProtocol): Promise<PendleWstETHRegistry> {
  const implementation = await createContractWithAbi<PendleWstETHRegistry>(
    PendleWstETHRegistry__factory.abi,
    PendleWstETHRegistry__factory.bytecode,
    [],
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPendleWstETHRegistryConstructorParams(implementation, core),
  );

  return PendleWstETHRegistry__factory.connect(registry.address, core.hhUser1);
}

export async function createPendleRETHRegistry(core: CoreProtocol): Promise<PendleRETHRegistry> {
  const implementation = await createContractWithAbi<PendleRETHRegistry>(
    PendleRETHRegistry__factory.abi,
    PendleRETHRegistry__factory.bytecode,
    [],
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getPendleRETHRegistryConstructorParams(implementation, core),
  );

  return PendleRETHRegistry__factory.connect(registry.address, core.hhUser1);
}

export function createPendlePtRETHIsolationModeTokenVaultV1(): Promise<PendlePtRETHIsolationModeTokenVaultV1> {
  return createContractWithAbi(
    PendlePtRETHIsolationModeTokenVaultV1__factory.abi,
    PendlePtRETHIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createPendlePtRETHIsolationModeVaultFactory(
  core: CoreProtocol,
  registry: IPendleRETHRegistry | PendleRETHRegistry,
  ptWstEthToken: IPendlePtToken,
  userVaultImplementation: IPendlePtRETHIsolationModeTokenVaultV1 | PendlePtRETHIsolationModeTokenVaultV1,
): Promise<PendlePtRETHIsolationModeVaultFactory> {
  return createContractWithAbi(
    PendlePtRETHIsolationModeVaultFactory__factory.abi,
    PendlePtRETHIsolationModeVaultFactory__factory.bytecode,
    getPendlePtRETHIsolationModeVaultFactoryConstructorParams(
      core,
      registry,
      ptWstEthToken,
      userVaultImplementation,
    ),
  );
}

export function createPendlePtRETHIsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): Promise<PendlePtRETHIsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendlePtRETHIsolationModeWrapperTraderV2__factory.abi,
    PendlePtRETHIsolationModeWrapperTraderV2__factory.bytecode,
    getPendlePtRETHIsolationModeWrapperTraderV2ConstructorParams(core, dptRETH, pendleRegistry),
  );
}

export function createPendlePtRETHIsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): Promise<PendlePtRETHIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendlePtRETHIsolationModeUnwrapperTraderV2__factory.abi,
    PendlePtRETHIsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendlePtRETHIsolationModeUnwrapperTraderV2ConstructorParams(core, dptRETH, pendleRegistry),
  );
}

export function createPendlePtRETHPriceOracle(
  core: CoreProtocol,
  dptRETH: IPendlePtRETHIsolationModeVaultFactory | PendlePtRETHIsolationModeVaultFactory,
  pendleRegistry: IPendleRETHRegistry | PendleRETHRegistry,
): Promise<PendlePtRETHPriceOracle> {
  return createContractWithAbi(
    PendlePtRETHPriceOracle__factory.abi,
    PendlePtRETHPriceOracle__factory.bytecode,
    getPendlePtRETHPriceOracleConstructorParams(core, dptRETH, pendleRegistry),
  );
}

export function createPendlePtWstETHIsolationModeTokenVaultV1(): Promise<PendlePtWstETHIsolationModeTokenVaultV1> {
  return createContractWithAbi(
    PendlePtWstETHIsolationModeTokenVaultV1__factory.abi,
    PendlePtWstETHIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createPendlePtWstETHIsolationModeVaultFactory(
  core: CoreProtocol,
  registry: IPendleWstETHRegistry | PendleWstETHRegistry,
  ptWstEthToken: IPendlePtToken,
  userVaultImplementation: IPendlePtWstETHIsolationModeTokenVaultV1 | PendlePtWstETHIsolationModeTokenVaultV1,
): Promise<PendlePtWstETHIsolationModeVaultFactory> {
  return createContractWithAbi(
    PendlePtWstETHIsolationModeVaultFactory__factory.abi,
    PendlePtWstETHIsolationModeVaultFactory__factory.bytecode,
    getPendlePtWstETHIsolationModeVaultFactoryConstructorParams(
      core,
      registry,
      ptWstEthToken,
      userVaultImplementation,
    ),
  );
}

export function createPendleWstETHPriceOracle(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): Promise<PendlePtWstETHPriceOracle> {
  return createContractWithAbi(
    PendlePtWstETHPriceOracle__factory.abi,
    PendlePtWstETHPriceOracle__factory.bytecode,
    getPendlePtWstETHPriceOracleConstructorParams(core, dptWstEth, pendleRegistry),
  );
}

export function createPendlePtWstETHIsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): Promise<PendlePtWstETHIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    PendlePtWstETHIsolationModeUnwrapperTraderV2__factory.abi,
    PendlePtWstETHIsolationModeUnwrapperTraderV2__factory.bytecode,
    getPendlePtWstETHIsolationModeUnwrapperTraderV2ConstructorParams(core, dptWstEth, pendleRegistry),
  );
}

export function createPendlePtWstETHIsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dptWstEth: IPendlePtWstETHIsolationModeVaultFactory | PendlePtWstETHIsolationModeVaultFactory,
  pendleRegistry: IPendleWstETHRegistry | PendleWstETHRegistry,
): Promise<PendlePtWstETHIsolationModeWrapperTraderV2> {
  return createContractWithAbi(
    PendlePtWstETHIsolationModeWrapperTraderV2__factory.abi,
    PendlePtWstETHIsolationModeWrapperTraderV2__factory.bytecode,
    getPendlePtWstETHIsolationModeWrapperTraderV2ConstructorParams(core, dptWstEth, pendleRegistry),
  );
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

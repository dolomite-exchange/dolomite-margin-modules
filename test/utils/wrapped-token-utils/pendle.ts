import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IPendlePtGLP2024Registry, IPendlePtGLP2024WrappedTokenUserVaultFactory,
  IPendlePtGLP2024WrappedTokenUserVaultV1,
  PendlePtGLP2024Registry,
  PendlePtGLP2024Registry__factory,
  PendlePtGLP2024WrappedTokenUserVaultFactory,
  PendlePtGLP2024WrappedTokenUserVaultFactory__factory,
  PendlePtGLP2024WrappedTokenUserVaultV1,
  PendlePtGLP2024WrappedTokenUserVaultV1__factory,
  PendlePtGLPPriceOracle,
  PendlePtGLPPriceOracle__factory,
  PendlePtGLPUnwrapperTrader,
  PendlePtGLPUnwrapperTrader__factory,
  PendlePtGLPWrapperTrader,
  PendlePtGLPWrapperTrader__factory,
} from '../../../src/types';
import {
  getPendlePtGLP2024RegistryConstructorParams,
  getPendlePtGLP2024UnwrapperTraderConstructorParams,
  getPendlePtGLP2024WrappedTokenUserVaultFactoryConstructorParams, getPendlePtGLP2024WrapperTraderConstructorParams,
  getPendlePtGLPPriceOracleConstructorParams,
} from '../../../src/utils/constructors/pendle';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export function createPendlePtGLP2024Registry(core: CoreProtocol): Promise<PendlePtGLP2024Registry> {
  return createContractWithAbi(
    PendlePtGLP2024Registry__factory.abi,
    PendlePtGLP2024Registry__factory.bytecode,
    getPendlePtGLP2024RegistryConstructorParams(core),
  );
}

export function createPendlePtGLP2024WrappedTokenUserVaultV1(): Promise<PendlePtGLP2024WrappedTokenUserVaultV1> {
  return createContractWithAbi(
    PendlePtGLP2024WrappedTokenUserVaultV1__factory.abi,
    PendlePtGLP2024WrappedTokenUserVaultV1__factory.bytecode,
    [],
  );
}

export function createPendlePtGLP2024PriceOracle(
  core: CoreProtocol,
  dptGlp: IPendlePtGLP2024WrappedTokenUserVaultFactory | PendlePtGLP2024WrappedTokenUserVaultFactory,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): Promise<PendlePtGLPPriceOracle> {
  return createContractWithAbi(
    PendlePtGLPPriceOracle__factory.abi,
    PendlePtGLPPriceOracle__factory.bytecode,
    getPendlePtGLPPriceOracleConstructorParams(core, dptGlp, pendleRegistry),
  );
}

export function createPendlePtGLP2024UnwrapperTrader(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): Promise<PendlePtGLPUnwrapperTrader> {
  return createContractWithAbi(
    PendlePtGLPUnwrapperTrader__factory.abi,
    PendlePtGLPUnwrapperTrader__factory.bytecode,
    getPendlePtGLP2024UnwrapperTraderConstructorParams(core, pendleRegistry),
  );
}

export function createPendlePtGLP2024WrapperTrader(
  core: CoreProtocol,
  pendleRegistry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
): Promise<PendlePtGLPWrapperTrader> {
  return createContractWithAbi(
    PendlePtGLPWrapperTrader__factory.abi,
    PendlePtGLPWrapperTrader__factory.bytecode,
    getPendlePtGLP2024WrapperTraderConstructorParams(core, pendleRegistry),
  );
}

export function createPendlePtGLP2024WrappedTokenUserVaultFactory(
  core: CoreProtocol,
  registry: IPendlePtGLP2024Registry | PendlePtGLP2024Registry,
  ptGlpToken: { address: address },
  userVaultImplementation: IPendlePtGLP2024WrappedTokenUserVaultV1 | PendlePtGLP2024WrappedTokenUserVaultV1,
): Promise<PendlePtGLP2024WrappedTokenUserVaultFactory> {
  return createContractWithAbi<PendlePtGLP2024WrappedTokenUserVaultFactory>(
    PendlePtGLP2024WrappedTokenUserVaultFactory__factory.abi,
    PendlePtGLP2024WrappedTokenUserVaultFactory__factory.bytecode,
    getPendlePtGLP2024WrappedTokenUserVaultFactoryConstructorParams(
      core,
      registry,
      ptGlpToken,
      userVaultImplementation,
    ),
  );
}

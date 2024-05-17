import { address } from '@dolomite-exchange/dolomite-margin';
import { RegistryProxy, RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  IUmamiAssetVault,
  IUmamiAssetVaultIsolationModeTokenVaultV1,
  IUmamiAssetVaultRegistry,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeVaultFactory__factory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultIsolationModeWrapperTraderV2__factory,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultPriceOracle__factory,
  UmamiAssetVaultRegistry,
  UmamiAssetVaultRegistry__factory,
} from '../src/types';
import {
  getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams,
  getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams,
  getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams,
  getUmamiAssetVaultPriceOracleConstructorParams,
  getUmamiAssetVaultRegistryConstructorParams,
} from '../src/umami-constructors';

export async function createUmamiAssetVaultIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  umamiAssetVaultToken: IUmamiAssetVault,
  userVaultImplementation: IUmamiAssetVaultIsolationModeTokenVaultV1 | UmamiAssetVaultIsolationModeTokenVaultV1,
): Promise<UmamiAssetVaultIsolationModeVaultFactory> {
  return createContractWithAbi<UmamiAssetVaultIsolationModeVaultFactory>(
    UmamiAssetVaultIsolationModeVaultFactory__factory.abi,
    UmamiAssetVaultIsolationModeVaultFactory__factory.bytecode,
    await getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams(
      core,
      umamiAssetVaultRegistry,
      umamiAssetVaultToken,
      userVaultImplementation,
    ),
  );
}

export function createUmamiAssetVaultIsolationModeTokenVaultV1(): Promise<UmamiAssetVaultIsolationModeTokenVaultV1> {
  return createContractWithAbi(
    UmamiAssetVaultIsolationModeTokenVaultV1__factory.abi,
    UmamiAssetVaultIsolationModeTokenVaultV1__factory.bytecode,
    [],
  );
}

export function createUmamiAssetVaultPriceOracle(
  core: CoreProtocolArbitrumOne,
  umamiAssetVaultRegistry: UmamiAssetVaultRegistry,
  dUmamiAssetVaultToken: { address: address },
): Promise<UmamiAssetVaultPriceOracle> {
  return createContractWithAbi<UmamiAssetVaultPriceOracle>(
    UmamiAssetVaultPriceOracle__factory.abi,
    UmamiAssetVaultPriceOracle__factory.bytecode,
    getUmamiAssetVaultPriceOracleConstructorParams(
      core,
      umamiAssetVaultRegistry,
      dUmamiAssetVaultToken,
    ),
  );
}

export function createUmamiAssetVaultIsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  dUmamiAssetVaultToken: { address: address },
): Promise<UmamiAssetVaultIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<UmamiAssetVaultIsolationModeUnwrapperTraderV2>(
    UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory.abi,
    UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory.bytecode,
    getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      umamiAssetVaultRegistry,
      dUmamiAssetVaultToken,
    ),
  );
}

export async function createUmamiAssetVaultRegistry(
  core: CoreProtocolArbitrumOne,
): Promise<UmamiAssetVaultRegistry> {
  const implementation = await createContractWithAbi<UmamiAssetVaultRegistry>(
    UmamiAssetVaultRegistry__factory.abi,
    UmamiAssetVaultRegistry__factory.bytecode,
    [],
  );
  const registry = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getUmamiAssetVaultRegistryConstructorParams(core, implementation),
  );

  return UmamiAssetVaultRegistry__factory.connect(registry.address, core.hhUser1);
}

export function createUmamiAssetVaultIsolationModeWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  umamiAssetVaultRegistry: IUmamiAssetVaultRegistry | UmamiAssetVaultRegistry,
  dUmamiAssetVaultToken: { address: address },
): Promise<UmamiAssetVaultIsolationModeWrapperTraderV2> {
  return createContractWithAbi<UmamiAssetVaultIsolationModeWrapperTraderV2>(
    UmamiAssetVaultIsolationModeWrapperTraderV2__factory.abi,
    UmamiAssetVaultIsolationModeWrapperTraderV2__factory.bytecode,
    getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams(
      core,
      umamiAssetVaultRegistry,
      dUmamiAssetVaultToken,
    ),
  );
}

import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IUmamiAssetVault,
  IUmamiAssetVaultIsolationModeTokenVaultV1,
  IUmamiAssetVaultRegistry,
  RegistryProxy,
  RegistryProxy__factory,
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
} from '../../../src/types';
import {
  getUmamiAssetVaultIsolationModeUnwrapperTraderV2ConstructorParams,
  getUmamiAssetVaultIsolationModeVaultFactoryConstructorParams,
  getUmamiAssetVaultIsolationModeWrapperTraderV2ConstructorParams,
  getUmamiAssetVaultPriceOracleConstructorParams,
  getUmamiAssetVaultRegistryConstructorParams,
} from '../../../src/utils/constructors/umami';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { CoreProtocol } from '../../../packages/base/test/utils/setup';

export async function createUmamiAssetVaultIsolationModeVaultFactory(
  core: CoreProtocol,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
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
  core: CoreProtocol,
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

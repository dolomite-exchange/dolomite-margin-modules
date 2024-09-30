import { RegistryProxy, RegistryProxy__factory, SimpleIsolationModeUnwrapperTraderV2, SimpleIsolationModeUnwrapperTraderV2__factory, SimpleIsolationModeWrapperTraderV2, SimpleIsolationModeWrapperTraderV2__factory } from "packages/base/src/types";
import { createContractWithAbi, createContractWithLibrary } from "packages/base/src/utils/dolomite-utils";
import { CoreProtocolBerachain } from "packages/base/test/utils/core-protocols/core-protocol-berachain";
import { getBerachainRewardsIsolationModeVaultFactoryConstructorParams, getBerachainRewardsRegistryConstructorParams, getBerachainRewardsUnwrapperTraderV2ConstructorParams, getBerachainRewardsWrapperTraderV2ConstructorParams } from "../src/berachain-constructors";
import { BerachainRewardsIsolationModeTokenVaultV1, BerachainRewardsIsolationModeVaultFactory, BerachainRewardsIsolationModeVaultFactory__factory, BerachainRewardsRegistry, BerachainRewardsRegistry__factory, IBerachainRewardsIsolationModeVaultFactory, IBerachainRewardsRegistry } from "../src/types";
import { createIsolationModeTokenVaultV1ActionsImpl } from "packages/base/test/utils/dolomite";

export async function createBerachainRewardsRegistry(core: CoreProtocolBerachain, rewardVault: { address: string }): Promise<BerachainRewardsRegistry> {
  const implementation = await createContractWithAbi<BerachainRewardsRegistry>(
    BerachainRewardsRegistry__factory.abi,
    BerachainRewardsRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getBerachainRewardsRegistryConstructorParams(implementation, rewardVault, core),
  );
  return BerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createBerachainRewardsIsolationModeTokenVaultV1(): Promise<BerachainRewardsIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<BerachainRewardsIsolationModeTokenVaultV1>(
    'BerachainRewardsIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createBerachainRewardsIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: BerachainRewardsIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<BerachainRewardsIsolationModeVaultFactory> {
  return createContractWithAbi<BerachainRewardsIsolationModeVaultFactory>(
    BerachainRewardsIsolationModeVaultFactory__factory.abi,
    BerachainRewardsIsolationModeVaultFactory__factory.bytecode,
    getBerachainRewardsIsolationModeVaultFactoryConstructorParams(beraRegistry, underlyingToken, userVaultImplementation, core),
  );
}

export async function createBerachainRewardsUnwrapperTraderV2(
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getBerachainRewardsUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createBerachainRewardsWrapperTraderV2(
  factory: IBerachainRewardsIsolationModeVaultFactory | BerachainRewardsIsolationModeVaultFactory,
  core: CoreProtocolBerachain,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getBerachainRewardsWrapperTraderV2ConstructorParams(factory, core),
  );
}

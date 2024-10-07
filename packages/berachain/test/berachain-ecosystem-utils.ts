import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  getBerachainRewardsIsolationModeVaultFactoryConstructorParams,
  getBerachainRewardsRegistryConstructorParams,
  getBerachainRewardsUnwrapperTraderV2ConstructorParams,
  getBerachainRewardsWrapperTraderV2ConstructorParams
} from '../src/berachain-constructors';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsIsolationModeVaultFactory__factory,
  BerachainRewardsMetavault,
  BerachainRewardsRegistry,
  BerachainRewardsRegistry__factory,
  IBerachainRewardsIsolationModeVaultFactory,
  IBerachainRewardsRegistry,
  MetavaultOperator,
  TestBerachainRewardsRegistry,
  TestBerachainRewardsRegistry__factory
} from '../src/types';
import { createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';

export enum RewardVaultType {
  Native,
  Infrared,
}

export async function createBerachainRewardsRegistry(
  core: CoreProtocolBerachain,
  metavaultImplementation: BerachainRewardsMetavault,
  metavaultOperator: MetavaultOperator
): Promise<BerachainRewardsRegistry> {
  const implementation = await createContractWithAbi<BerachainRewardsRegistry>(
    BerachainRewardsRegistry__factory.abi,
    BerachainRewardsRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getBerachainRewardsRegistryConstructorParams(
      implementation,
      metavaultImplementation,
      metavaultOperator,
      core
    ),
  );
  return BerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestBerachainRewardsRegistry(
  core: CoreProtocolBerachain,
  metavaultImplementation: BerachainRewardsMetavault,
  metavaultOperator: MetavaultOperator
): Promise<TestBerachainRewardsRegistry> {
  const implementation = await createContractWithAbi<TestBerachainRewardsRegistry>(
    TestBerachainRewardsRegistry__factory.abi,
    TestBerachainRewardsRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getBerachainRewardsRegistryConstructorParams(
      implementation,
      metavaultImplementation,
      metavaultOperator,
      core
    ),
  );
  return TestBerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createBerachainRewardsIsolationModeTokenVaultV1(
): Promise<BerachainRewardsIsolationModeTokenVaultV1> {
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
    getBerachainRewardsIsolationModeVaultFactoryConstructorParams(
      beraRegistry,
      underlyingToken,
      userVaultImplementation,
      core
    ),
  );
}

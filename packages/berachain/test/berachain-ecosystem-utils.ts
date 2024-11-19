import {
  RegistryProxy,
  RegistryProxy__factory,
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  getBerachainRewardsIsolationModeVaultFactoryConstructorParams,
  getBerachainRewardsRegistryConstructorParams,
  getBGTIsolationModeVaultFactoryConstructorParams,
  getInfraredBGTIsolationModeVaultFactoryConstructorParams
} from '../src/berachain-constructors';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsIsolationModeVaultFactory__factory,
  BerachainRewardsMetaVault,
  BerachainRewardsRegistry,
  BerachainRewardsRegistry__factory,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeVaultFactory,
  BGTIsolationModeVaultFactory__factory,
  IBerachainRewardsRegistry,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTIsolationModeVaultFactory__factory,
  MetaVaultOperator,
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
  metaVaultImplementation: BerachainRewardsMetaVault,
  metaVaultOperator: MetaVaultOperator
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
      metaVaultImplementation,
      metaVaultOperator,
      core
    ),
  );
  return BerachainRewardsRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestBerachainRewardsRegistry(
  core: CoreProtocolBerachain,
  metaVaultImplementation: BerachainRewardsMetaVault,
  metaVaultOperator: MetaVaultOperator
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
      metaVaultImplementation,
      metaVaultOperator,
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

export async function createBGTIsolationModeTokenVaultV1(
): Promise<BGTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<BGTIsolationModeTokenVaultV1>(
    'BGTIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createBGTIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: BGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<BGTIsolationModeVaultFactory> {
  return createContractWithAbi<BGTIsolationModeVaultFactory>(
    BGTIsolationModeVaultFactory__factory.abi,
    BGTIsolationModeVaultFactory__factory.bytecode,
    getBGTIsolationModeVaultFactoryConstructorParams(
      beraRegistry,
      underlyingToken,
      userVaultImplementation,
      core
    ),
  );
}

export async function createInfraredBGTIsolationModeTokenVaultV1(
): Promise<InfraredBGTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<InfraredBGTIsolationModeTokenVaultV1>(
    'InfraredBGTIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createInfraredBGTIsolationModeVaultFactory(
  beraRegistry: IBerachainRewardsRegistry | BerachainRewardsRegistry,
  underlyingToken: { address: string },
  userVaultImplementation: InfraredBGTIsolationModeTokenVaultV1,
  core: CoreProtocolBerachain,
): Promise<InfraredBGTIsolationModeVaultFactory> {
  return createContractWithAbi<InfraredBGTIsolationModeVaultFactory>(
    InfraredBGTIsolationModeVaultFactory__factory.abi,
    InfraredBGTIsolationModeVaultFactory__factory.bytecode,
    getInfraredBGTIsolationModeVaultFactoryConstructorParams(
      beraRegistry,
      underlyingToken,
      userVaultImplementation,
      core
    ),
  );
}

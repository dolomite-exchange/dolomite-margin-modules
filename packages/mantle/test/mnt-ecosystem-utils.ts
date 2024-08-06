import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary, createContractWithName,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import { setupTestMarket } from 'packages/base/test/utils/setup';
import {
  getMNTIsolationModeVaultFactoryConstructorParams,
  getMNTRegistryConstructorParams,
  getMNTUnwrapperTraderV2ConstructorParams,
  getMNTWrapperTraderV2ConstructorParams,
} from '../src/mnt-constructors';
import {
  IMNTIsolationModeVaultFactory,
  IMNTRegistry, IWETH,
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeVaultFactory,
  MNTIsolationModeVaultFactory__factory,
  MNTRegistry,
  MNTRegistry__factory,
  TestMNTIsolationModeTokenVaultV1,
  TestWMNT,
} from '../src/types';

export async function setupWmntToken(core: CoreProtocolMantle): Promise<IWETH> {
  if (process.env.COVERAGE === 'true') {
    console.log('\tUsing TestWMNT for coverage...');
    const wmnt = await createContractWithName<TestWMNT>('TestWMNT', []);
    await core.chroniclePriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
      wmnt.address,
      await core.chroniclePriceOracleV3.getScribeByToken(core.tokens.wmnt.address),
      false,
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: wmnt.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(core.tokens.wmnt.address),
    });
    await setupTestMarket(
      core,
      wmnt,
      false,
      core.oracleAggregatorV2,
    );

    return wmnt;
  }

  return core.tokens.wmnt;
}

export async function createMNTRegistry(core: CoreProtocolMantle): Promise<MNTRegistry> {
  const implementation = await createContractWithAbi<MNTRegistry>(
    MNTRegistry__factory.abi,
    MNTRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getMNTRegistryConstructorParams(implementation, core),
  );
  return MNTRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createMNTIsolationModeTokenVaultV1(): Promise<MNTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<MNTIsolationModeTokenVaultV1>('MNTIsolationModeTokenVaultV1', libraries, []);
}

export async function createTestMNTIsolationModeTokenVaultV1(): Promise<TestMNTIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestMNTIsolationModeTokenVaultV1>('TestMNTIsolationModeTokenVaultV1', libraries, []);
}

export async function createMNTIsolationModeVaultFactory(
  arbRegistry: IMNTRegistry | MNTRegistry,
  userVaultImplementation: MNTIsolationModeTokenVaultV1,
  wmnt: IWETH,
  core: CoreProtocolMantle,
): Promise<MNTIsolationModeVaultFactory> {
  return createContractWithAbi<MNTIsolationModeVaultFactory>(
    MNTIsolationModeVaultFactory__factory.abi,
    MNTIsolationModeVaultFactory__factory.bytecode,
    getMNTIsolationModeVaultFactoryConstructorParams(arbRegistry, userVaultImplementation, wmnt, core),
  );
}

export async function createMNTUnwrapperTraderV2(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getMNTUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createMNTWrapperTraderV2(
  factory: IMNTIsolationModeVaultFactory | MNTIsolationModeVaultFactory,
  core: CoreProtocolMantle,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getMNTWrapperTraderV2ConstructorParams(factory, core),
  );
}

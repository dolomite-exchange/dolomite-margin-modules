import { BigNumberish } from 'ethers';
import {
  CustomTestToken,
  HandlerRegistry,
  TestAsyncIsolationModeTraderBase,
  TestAsyncIsolationModeTraderBase__factory,
  TestFreezableIsolationModeVaultFactory,
  TestFreezableIsolationModeVaultFactory__factory,
  TestHandlerRegistry,
  TestHandlerRegistry__factory,
  TestIsolationModeFactory,
  TestIsolationModeFactory__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1WithFreezable,
  TestIsolationModeTokenVaultV1WithFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { createRegistryProxy } from '../dolomite';
import { CoreProtocol } from '../setup';

type TestIsolationModeTokenVault =
  TestIsolationModeTokenVaultV1
  | TestIsolationModeTokenVaultV1WithPausable
  | TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;

export async function createTestIsolationModeFactory(
  core: CoreProtocol,
  underlyingToken: CustomTestToken,
  userVaultImplementation: TestIsolationModeTokenVault,
): Promise<TestIsolationModeFactory> {
  return await createContractWithAbi<TestIsolationModeFactory>(
    TestIsolationModeFactory__factory.abi,
    TestIsolationModeFactory__factory.bytecode,
    [
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

type FreezableVault =
  TestIsolationModeTokenVaultV1WithFreezable
  | TestIsolationModeTokenVaultV1WithFreezableAndPausable;

export async function createTestHandlerRegistry(
  core: CoreProtocol,
): Promise<TestHandlerRegistry> {
  const implementation = await createContractWithAbi<TestHandlerRegistry>(
    TestHandlerRegistry__factory.abi,
    TestHandlerRegistry__factory.bytecode,
    [],
  );
  const data = await implementation.populateTransaction.initialize(core.dolomiteRegistryProxy.address);
  const proxy = await createRegistryProxy(implementation.address, data.data!, core);
  return TestHandlerRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestFreezableIsolationModeVaultFactory(
  executionFee: BigNumberish,
  registry: TestHandlerRegistry,
  core: CoreProtocol,
  underlyingToken: CustomTestToken,
  userVaultImplementation: FreezableVault,
): Promise<TestFreezableIsolationModeVaultFactory> {
  return await createContractWithAbi<TestFreezableIsolationModeVaultFactory>(
    TestFreezableIsolationModeVaultFactory__factory.abi,
    TestFreezableIsolationModeVaultFactory__factory.bytecode,
    [
      executionFee,
      registry.address,
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

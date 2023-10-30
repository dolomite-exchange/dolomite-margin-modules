import { BigNumberish } from 'ethers';
import {
  CustomTestToken,
  TestFreezableIsolationModeFactory,
  TestFreezableIsolationModeFactory__factory,
  TestIsolationModeFactory,
  TestIsolationModeFactory__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1WithFreezable,
  TestIsolationModeTokenVaultV1WithFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
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

export async function createTestFreezableIsolationModeFactory(
  executionFee: BigNumberish,
  core: CoreProtocol,
  underlyingToken: CustomTestToken,
  userVaultImplementation: FreezableVault,
): Promise<TestFreezableIsolationModeFactory> {
  return await createContractWithAbi<TestFreezableIsolationModeFactory>(
    TestFreezableIsolationModeFactory__factory.abi,
    TestFreezableIsolationModeFactory__factory.bytecode,
    [
      executionFee,
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

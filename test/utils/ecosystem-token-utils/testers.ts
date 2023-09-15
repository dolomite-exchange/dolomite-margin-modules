import { testIsolationModeTokenVaultWithFreezableSol } from 'src/types/contracts/test';
import {
  CustomTestToken,
  TestIsolationModeFactory,
  TestIsolationModeFactory__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1WithFreezable,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createTestIsolationModeFactory(
  core: CoreProtocol,
  underlyingToken: CustomTestToken,
  userVaultImplementation: TestIsolationModeTokenVaultV1 | TestIsolationModeTokenVaultV1WithFreezable,
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

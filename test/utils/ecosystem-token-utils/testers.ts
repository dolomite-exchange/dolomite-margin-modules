import { address } from '@dolomite-exchange/dolomite-margin';
import { TestIsolationModeFactory, TestIsolationModeFactory__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createTestIsolationModeFactory(
  core: CoreProtocol,
  underlyingToken: { address: address },
  userVaultImplementation: { address: address },
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

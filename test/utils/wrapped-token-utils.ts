import { address } from '@dolomite-exchange/dolomite-margin';
import {
  GLPUnwrapperProxyV1,
  GLPUnwrapperProxyV1__factory,
  GLPWrapperProxyV1,
  GLPWrapperProxyV1__factory,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
} from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { CoreProtocol } from './setup';

export async function createTestWrappedTokenFactory(
  core: CoreProtocol,
  underlyingToken: { address: address },
  userVaultImplementation: { address: address },
): Promise<TestWrappedTokenUserVaultFactory> {
  return await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
    TestWrappedTokenUserVaultFactory__factory.abi,
    TestWrappedTokenUserVaultFactory__factory.bytecode,
    [
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createGlpUnwrapperProxy(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPUnwrapperProxyV1> {
  return createContractWithAbi<GLPUnwrapperProxyV1>(
    GLPUnwrapperProxyV1__factory.abi,
    GLPUnwrapperProxyV1__factory.bytecode,
    [
      core.usdc.address,
      gmxRegistry.address,
      dfsGlp.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createGlpWrapperProxy(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPWrapperProxyV1> {
  return createContractWithAbi<GLPWrapperProxyV1>(
    GLPWrapperProxyV1__factory.abi,
    GLPWrapperProxyV1__factory.bytecode,
    [
      core.usdc.address,
      gmxRegistry.address,
      dfsGlp.address,
      core.dolomiteMargin.address,
    ],
  );
}

import { address } from '@dolomite-exchange/dolomite-margin';
import {
  GLPUnwrapperProxyV1,
  GLPUnwrapperProxyV1__factory,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
} from '../../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  DOLOMITE_MARGIN,
  GLP,
  GLP_MANAGER,
  GLP_REWARDS_ROUTER,
  GMX_VAULT,
  USDC,
} from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';

export async function createWrappedTokenFactory(
  underlyingToken: { address: address },
  userVaultImplementation: { address: address },
): Promise<TestWrappedTokenUserVaultFactory> {
  return await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
    TestWrappedTokenUserVaultFactory__factory.abi,
    TestWrappedTokenUserVaultFactory__factory.bytecode,
    [
      underlyingToken.address,
      BORROW_POSITION_PROXY_V2.address,
      userVaultImplementation.address,
      DOLOMITE_MARGIN.address,
    ],
  );
}

export async function createGlpUnwrapperProxy(
  wrappedTokenFactory: { address: address },
): Promise<GLPUnwrapperProxyV1> {
  return createContractWithAbi<GLPUnwrapperProxyV1>(
    GLPUnwrapperProxyV1__factory.abi,
    GLPUnwrapperProxyV1__factory.bytecode,
    [
      USDC.address,
      GLP_MANAGER.address,
      GLP_REWARDS_ROUTER.address,
      GMX_VAULT.address,
      GLP.address,
      wrappedTokenFactory.address,
      DOLOMITE_MARGIN.address,
    ],
  );

}

import { address } from '@dolomite-exchange/dolomite-margin';
import {
  GLPUnwrapperProxyV1,
  GLPUnwrapperProxyV1__factory,
  GLPWrapperProxyV1,
  GLPWrapperProxyV1__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
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

export function getGlpUnwrapperProxyConstructorParams(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function createGlpUnwrapperProxy(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPUnwrapperProxyV1> {
  return createContractWithAbi<GLPUnwrapperProxyV1>(
    GLPUnwrapperProxyV1__factory.abi,
    GLPUnwrapperProxyV1__factory.bytecode,
    getGlpUnwrapperProxyConstructorParams(core, dfsGlp, gmxRegistry)
  );
}

export function getGlpWrapperProxyConstructorParams(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): any[] {
  return [
    core.usdc.address,
    gmxRegistry.address,
    dfsGlp.address,
    core.dolomiteMargin.address,
  ];
}

export async function createGlpWrapperProxy(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPWrapperProxyV1> {
  return createContractWithAbi<GLPWrapperProxyV1>(
    GLPWrapperProxyV1__factory.abi,
    GLPWrapperProxyV1__factory.bytecode,
    getGlpWrapperProxyConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export function getGmxRegistryConstructorParams(core: CoreProtocol): any[] {
  return [
    {
      esGmx: core.gmxEcosystem.esGmx.address,
      fsGlp: core.gmxEcosystem.fsGlp.address,
      glp: core.gmxEcosystem.glp.address,
      glpManager: core.gmxEcosystem.glpManager.address,
      glpRewardsRouter: core.gmxEcosystem.glpRewardsRouter.address,
      gmx: core.gmxEcosystem.gmx.address,
      gmxRewardsRouter: core.gmxEcosystem.gmxRewardsRouter.address,
      gmxVault: core.gmxEcosystem.gmxVault.address,
      sGlp: core.gmxEcosystem.sGlp.address,
      sGmx: core.gmxEcosystem.sGmx.address,
      sbfGmx: core.gmxEcosystem.sbfGmx.address,
      vGlp: core.gmxEcosystem.vGlp.address,
      vGmx: core.gmxEcosystem.vGmx.address,
    },
    core.dolomiteMargin.address,
  ];
}

export function createGmxRegistry(core: CoreProtocol): Promise<GmxRegistryV1> {
  return createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    getGmxRegistryConstructorParams(core),
  );
}

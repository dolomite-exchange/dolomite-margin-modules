import { address } from '@dolomite-exchange/dolomite-margin';
import {
  GLPUnwrapperTraderV1,
  GLPUnwrapperTraderV1__factory,
  GLPWrapperTraderV1,
  GLPWrapperTraderV1__factory,
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

export function getGlpUnwrapperTraderConstructorParams(
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

export async function createGlpUnwrapperTrader(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPUnwrapperTraderV1> {
  return createContractWithAbi<GLPUnwrapperTraderV1>(
    GLPUnwrapperTraderV1__factory.abi,
    GLPUnwrapperTraderV1__factory.bytecode,
    getGlpUnwrapperTraderConstructorParams(core, dfsGlp, gmxRegistry)
  );
}

export function getGlpWrapperTraderConstructorParams(
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

export async function createGlpWrapperTrader(
  core: CoreProtocol,
  dfsGlp: { address: address },
  gmxRegistry: { address: address },
): Promise<GLPWrapperTraderV1> {
  return createContractWithAbi<GLPWrapperTraderV1>(
    GLPWrapperTraderV1__factory.abi,
    GLPWrapperTraderV1__factory.bytecode,
    getGlpWrapperTraderConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export function getGmxRegistryConstructorParams(core: CoreProtocol): any[] {
  if (!core.gmxEcosystem) {
    throw new Error('GMX ecosystem not initialized');
  }

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

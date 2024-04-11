import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  IJonesGLPAdapter,
  IJonesGLPAdapter__factory,
  IJonesGLPVaultRouter,
  IJonesGLPVaultRouter__factory,
  IJonesRouter,
  IJonesRouter__factory,
  IJonesUSDCFarm,
  IJonesUSDCFarm__factory,
  IJonesUSDCRegistry,
  IJonesUSDCRegistry__factory,
  IJonesWhitelistController,
  IJonesWhitelistController__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
} from '@dolomite-exchange/modules-jones/src/types';
import { IAlgebraV3Pool, IAlgebraV3Pool__factory } from '@dolomite-exchange/modules-oracles/src/types';
import {
  IERC4626,
  IERC4626__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  JONES_ECOSYSTEM_GOVERNOR_MAP,
  JONES_GLP_ADAPTER_MAP,
  JONES_GLP_VAULT_ROUTER_MAP,
  JONES_JUSDC_FARM_MAP,
  JONES_JUSDC_MAP,
  JONES_JUSDC_RECEIPT_TOKEN_MAP,
  JONES_ROUTER_MAP,
  JONES_WETH_V3_POOL_MAP,
  JONES_WHITELIST_CONTROLLER_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonateOrFallback } from '../index';
import { getContract } from '../setup';

export interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistController: IJonesWhitelistController;
  router: IJonesRouter;
  usdcReceiptToken: IERC4626;
  jUSDC: IERC4626;
  jUSDCFarm: IJonesUSDCFarm;
  admin: SignerWithAddressWithSafety;
  jonesWethV3Pool: IAlgebraV3Pool;
  live: {
    jUSDCIsolationModeFactory: JonesUSDCIsolationModeVaultFactory;
    jonesUSDCRegistry: IJonesUSDCRegistry;
    jonesUSDCRegistryProxy: RegistryProxy;
  };
}

export async function createJonesEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<JonesEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const whitelist = getContract(
    JONES_WHITELIST_CONTROLLER_MAP[network] as string,
    IJonesWhitelistController__factory.connect,
    signer,
  );
  return {
    admin: await impersonateOrFallback(JONES_ECOSYSTEM_GOVERNOR_MAP[network]!, true, signer),
    glpAdapter: getContract(
      JONES_GLP_ADAPTER_MAP[network] as string,
      IJonesGLPAdapter__factory.connect,
      signer,
    ),
    glpVaultRouter: getContract(
      JONES_GLP_VAULT_ROUTER_MAP[network] as string,
      IJonesGLPVaultRouter__factory.connect,
      signer,
    ),
    jonesWethV3Pool: getContract(JONES_WETH_V3_POOL_MAP[network] as string, IAlgebraV3Pool__factory.connect, signer),
    jUSDC: getContract(JONES_JUSDC_MAP[network] as string, IERC4626__factory.connect, signer),
    jUSDCFarm: getContract(JONES_JUSDC_FARM_MAP[network] as string, IJonesUSDCFarm__factory.connect, signer),
    router: getContract(JONES_ROUTER_MAP[network] as string, IJonesRouter__factory.connect, signer),
    usdcReceiptToken: getContract(
      JONES_JUSDC_RECEIPT_TOKEN_MAP[network] as string,
      IERC4626__factory.connect,
      signer,
    ),
    whitelistController: whitelist,
    live: {
      jUSDCIsolationModeFactory: getContract(
        (Deployments.JonesUSDCIsolationModeVaultFactory as any)[network]?.address,
        JonesUSDCIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      jonesUSDCRegistry: getContract(
        (Deployments.JonesUSDCRegistryProxy as any)[network]?.address,
        IJonesUSDCRegistry__factory.connect,
        signer,
      ),
      jonesUSDCRegistryProxy: getContract(
        (Deployments.JonesUSDCRegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  IJonesGLPAdapter,
  IJonesGLPAdapter__factory,
  IJonesGLPVaultRouter,
  IJonesGLPVaultRouter__factory,
  IJonesRouter,
  IJonesRouter__factory,
  IJonesStableCompoundV1__factory,
  IJonesStableVaultV1__factory,
  IJonesUSDC,
  IJonesUSDC__factory,
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
import { IERC20, IERC4626, IERC4626__factory, RegistryProxy, RegistryProxy__factory } from '../../../src/types';
import {
  JONES_ECOSYSTEM_GOVERNOR_MAP,
  JONES_GLP_ADAPTER_MAP,
  JONES_GLP_VAULT_ROUTER_MAP,
  JONES_JUSDC_FARM_MAP,
  JONES_JUSDC_OLD_MAP,
  JONES_JUSDC_RECEIPT_TOKEN_MAP,
  JONES_JUSDC_V2_MAP,
  JONES_ROUTER_V2_MAP,
  JONES_WETH_V3_POOL_MAP,
  JONES_WHITELIST_CONTROLLER_V1_MAP,
  JONES_WHITELIST_CONTROLLER_V2_MAP,
} from '../../../src/utils/constants';
import { ADDRESS_ZERO, Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { CoreProtocolArbitrumOne } from '../core-protocol';
import { impersonate, impersonateOrFallback } from '../index';
import { getContract } from '../setup';

const ENFORCE_HUB = '0x4D48518C5b9090871220F578D51F5d063dAFd5bB';
const JONES_ROUTER_V1 = '0x2F43c6475f1ecBD051cE486A9f3Ccc4b03F3d713';
const JONES_TRACKER_V1 = '0xEB23C7e19DB72F9a728fD64E1CAA459E457cfaca';
const JONES_STABLE_COMPOUND_V1 = '0xe66998533a1992ecE9eA99cDf47686F4fc8458E0';
const JONES_STABLE_VAULT_V1 = '0xa485a0bc44988B95245D5F20497CCaFF58a73E99';

export interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistControllerV1: IJonesWhitelistController;
  whitelistControllerV2: IJonesWhitelistController;
  router: IJonesRouter;
  usdcReceiptToken: IERC4626;
  jUsdc: IJonesUSDC;
  jUsdcOld: IERC4626;
  jUSDCFarm: IJonesUSDCFarm;
  admin: SignerWithAddressWithSafety;
  jonesWethV3Pool: IAlgebraV3Pool;
  live: {
    jUSDCIsolationModeFactoryOld: JonesUSDCIsolationModeVaultFactory;
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
    jUsdc: getContract(JONES_JUSDC_V2_MAP[network] as string, IJonesUSDC__factory.connect, signer),
    jUsdcOld: getContract(JONES_JUSDC_OLD_MAP[network] as string, IERC4626__factory.connect, signer),
    jUSDCFarm: getContract(JONES_JUSDC_FARM_MAP[network] as string, IJonesUSDCFarm__factory.connect, signer),
    router: getContract(JONES_ROUTER_V2_MAP[network] as string, IJonesRouter__factory.connect, signer),
    usdcReceiptToken: getContract(
      JONES_JUSDC_RECEIPT_TOKEN_MAP[network] as string,
      IERC4626__factory.connect,
      signer,
    ),
    whitelistControllerV1: getContract(
      JONES_WHITELIST_CONTROLLER_V1_MAP[network] as string,
      IJonesWhitelistController__factory.connect,
      signer,
    ),
    whitelistControllerV2: getContract(
      JONES_WHITELIST_CONTROLLER_V2_MAP[network] as string,
      IJonesWhitelistController__factory.connect,
      signer,
    ),
    live: {
      jUSDCIsolationModeFactoryOld: getContract(
        (Deployments.JonesUSDCV1IsolationModeVaultFactory as any)[network]?.address,
        JonesUSDCIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      jonesUSDCRegistry: getContract(
        (Deployments.JonesUSDCV1RegistryProxy as any)[network]?.address,
        IJonesUSDCRegistry__factory.connect,
        signer,
      ),
      jonesUSDCRegistryProxy: getContract(
        (Deployments.JonesUSDCV1RegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

export async function initializeNewJUsdc(
  core: CoreProtocolArbitrumOne,
  newJusdc: IERC20 = core.jonesEcosystem.jUsdc,
): Promise<void> {
  const admin = await impersonate('0xc8ce0aC725f914dBf1D743D51B6e222b79F479f1', true);
  const jonesStableCompound = IJonesStableCompoundV1__factory.connect(JONES_STABLE_COMPOUND_V1, admin);
  const jonesStableVault = IJonesStableVaultV1__factory.connect(JONES_STABLE_VAULT_V1, admin);

  if ('initialize' in newJusdc) {
    await (newJusdc as IJonesUSDC).connect(admin)
      .initialize(core.tokens.nativeUsdc.address, ENFORCE_HUB, 'Jones USDC', 'jUSDC');

    await (newJusdc as IJonesUSDC).connect(admin).addOperator(core.jonesEcosystem.router.address);
  }

  const compoundUVRT = await jonesStableCompound.totalAssets();
  await core.jonesEcosystem.router.connect(admin).initialize(
    JONES_ROUTER_V1,
    JONES_TRACKER_V1,
    core.jonesEcosystem.whitelistControllerV1.address,
    core.jonesEcosystem.whitelistControllerV1.address,
    newJusdc.address,
    ADDRESS_ZERO,
    compoundUVRT,
    (await jonesStableVault.totalSupply()).sub(compoundUVRT),
    await jonesStableCompound.totalSupply(),
  );
  await core.jonesEcosystem.whitelistControllerV1.connect(admin)
    .addToWhitelistContracts(core.dolomiteMigrator.address);
}

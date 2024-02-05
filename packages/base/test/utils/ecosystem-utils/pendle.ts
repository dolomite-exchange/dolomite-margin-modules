import {
  IPendleGLPRegistry,
  IPendleGLPRegistry__factory,
  IPendlePtMarket,
  IPendlePtMarket__factory,
  IPendlePtOracle,
  IPendlePtOracle__factory,
  IPendlePtToken,
  IPendlePtToken__factory,
  IPendleRegistry,
  IPendleRegistry__factory,
  IPendleRouter,
  IPendleRouter__factory,
  IPendleSyToken,
  IPendleSyToken__factory,
  IPendleYtToken,
  IPendleYtToken__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory__factory,
} from '@dolomite-exchange/modules-pendle/src/types';
import { RegistryProxy, RegistryProxy__factory, } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  PENDLE_PT_GLP_2024_MARKET_MAP,
  PENDLE_PT_GLP_2024_TOKEN_MAP,
  PENDLE_PT_ORACLE_MAP,
  PENDLE_PT_RETH_MARKET_MAP,
  PENDLE_PT_RETH_TOKEN_MAP,
  PENDLE_PT_WST_ETH_2024_MARKET_MAP,
  PENDLE_PT_WST_ETH_2024_TOKEN_MAP,
  PENDLE_PT_WST_ETH_2025_MARKET_MAP,
  PENDLE_PT_WST_ETH_2025_TOKEN_MAP,
  PENDLE_ROUTER_MAP,
  PENDLE_SY_GLP_TOKEN_MAP,
  PENDLE_SY_RETH_TOKEN_MAP,
  PENDLE_SY_WST_ETH_TOKEN_MAP,
  PENDLE_YT_GLP_2024_TOKEN_MAP
} from '../../../src/utils/constants';
import Deployments, * as deployments from '@dolomite-exchange/modules-scripts/src/deploy/deployments.json';
import { getContract } from '../setup';

export interface PendleEcosystem {
  pendleRouter: IPendleRouter;
  glpMar2024: {
    pendleRegistry: IPendleGLPRegistry;
    pendleRegistryProxy: RegistryProxy;
    ptGlpMarket: IPendlePtMarket;
    ptGlpToken: IPendlePtToken;
    ptOracle: IPendlePtOracle;
    ytGlpToken: IPendleYtToken;
    dPtGlp2024: PendlePtGLP2024IsolationModeVaultFactory;
    dYtGlp2024: PendleYtGLP2024IsolationModeVaultFactory;
  };
  rEthJun2025: {
    dPtREthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptREthMarket: IPendlePtMarket;
    ptREthToken: IPendlePtToken;
  };
  wstEthJun2024: {
    dPtWstEthJun2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  wstEthJun2025: {
    dPtWstEthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  syGlpToken: IPendleSyToken;
  syREthToken: IPendleSyToken;
  syWstEthToken: IPendleSyToken;
}

export async function createPendleEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PendleEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    pendleRouter: getContract(
      PENDLE_ROUTER_MAP[network] as string,
      IPendleRouter__factory.connect,
      signer,
    ),
    glpMar2024: {
      pendleRegistry: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        IPendleGLPRegistry__factory.connect,
        signer,
      ),
      pendleRegistryProxy: getContract(
        (Deployments.PendleGLP2024RegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
      ptGlpMarket: getContract(
        PENDLE_PT_GLP_2024_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptGlpToken: getContract(
        PENDLE_PT_GLP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ytGlpToken: getContract(
        PENDLE_YT_GLP_2024_TOKEN_MAP[network] as string,
        IPendleYtToken__factory.connect,
        signer,
      ),
      dPtGlp2024: getContract(
        (Deployments.PendlePtGLP2024IsolationModeVaultFactory as any)[network]?.address,
        PendlePtGLP2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
      dYtGlp2024: getContract(
        (Deployments.PendleYtGLP2024IsolationModeVaultFactory as any)[network]?.address,
        PendleYtGLP2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
    },
    rEthJun2025: {
      dPtREthJun2025: getContract(
        deployments.PendlePtREthJun2025IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleREthJun2025RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptREthMarket: getContract(
        PENDLE_PT_RETH_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptREthToken: getContract(
        PENDLE_PT_RETH_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    wstEthJun2024: {
      dPtWstEthJun2024: getContract(
        deployments.PendlePtWstEthJun2024IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2024RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptWstEthMarket: getContract(
        PENDLE_PT_WST_ETH_2024_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWstEthToken: getContract(
        PENDLE_PT_WST_ETH_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    wstEthJun2025: {
      dPtWstEthJun2025: getContract(
        deployments.PendlePtWstEthJun2025IsolationModeVaultFactory[network as '42161'].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2025RegistryProxy[network as '42161'].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(
        PENDLE_PT_ORACLE_MAP[network] as string,
        IPendlePtOracle__factory.connect,
        signer,
      ),
      ptWstEthMarket: getContract(
        PENDLE_PT_WST_ETH_2025_MARKET_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWstEthToken: getContract(
        PENDLE_PT_WST_ETH_2025_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    syGlpToken: getContract(
      PENDLE_SY_GLP_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syREthToken: getContract(
      PENDLE_SY_RETH_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syWstEthToken: getContract(
      PENDLE_SY_WST_ETH_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
  };
}

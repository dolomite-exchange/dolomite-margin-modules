import Deployments, * as deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
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
  PendlePtGLPMar2024IsolationModeVaultFactory,
  PendlePtGLPMar2024IsolationModeVaultFactory__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendleYtGLPMar2024IsolationModeVaultFactory,
  PendleYtGLPMar2024IsolationModeVaultFactory__factory,
} from '@dolomite-exchange/modules-pendle/src/types';
import { IPendleRouterV3, IPendleRouterV3__factory } from 'packages/pendle/src/types';
import { RegistryProxy, RegistryProxy__factory } from '../../../src/types';
import {
  PENDLE_MARKET_CM_ETH_FEB_2025_MAP,
  PENDLE_MARKET_E_ETH_APR_2024_MAP,
  PENDLE_MARKET_E_ETH_DEC_2024_MAP,
  PENDLE_MARKET_E_ETH_JUN_2024_MAP,
  PENDLE_MARKET_E_ETH_SEP_2024_MAP,
  PENDLE_MARKET_EZ_ETH_JUN_2024_MAP,
  PENDLE_MARKET_EZ_ETH_SEP_2024_MAP,
  PENDLE_MARKET_GLP_MAR_2024_MAP,
  PENDLE_MARKET_GLP_SEP_2024_MAP,
  PENDLE_MARKET_IBGT_DEC_2025_MAP,
  PENDLE_MARKET_METH_DEC_2024_MAP,
  PENDLE_MARKET_MNT_OCT_2024_MAP,
  PENDLE_MARKET_RETH_JUN_2025_MAP,
  PENDLE_MARKET_RS_ETH_APR_2024_MAP,
  PENDLE_MARKET_RS_ETH_DEC_2024_MAP,
  PENDLE_MARKET_RS_ETH_SEP_2024_MAP,
  PENDLE_MARKET_USDE_DEC_2024_MAP,
  PENDLE_MARKET_USDE_JUL_2024_MAP,
  PENDLE_MARKET_WST_ETH_2024_MAP,
  PENDLE_MARKET_WST_ETH_2025_MAP, PENDLE_PT_CM_ETH_FEB_2025_TOKEN_MAP,
  PENDLE_PT_E_ETH_APR_2024_TOKEN_MAP,
  PENDLE_PT_E_ETH_DEC_2024_TOKEN_MAP,
  PENDLE_PT_E_ETH_JUN_2024_TOKEN_MAP,
  PENDLE_PT_E_ETH_SEP_2024_TOKEN_MAP,
  PENDLE_PT_EZ_ETH_JUN_2024_TOKEN_MAP,
  PENDLE_PT_EZ_ETH_SEP_2024_TOKEN_MAP,
  PENDLE_PT_GLP_MAR_2024_TOKEN_MAP,
  PENDLE_PT_GLP_SEP_2024_TOKEN_MAP,
  PENDLE_PT_IBGT_DEC_2025_TOKEN_MAP,
  PENDLE_PT_METH_DEC_2024_TOKEN_MAP,
  PENDLE_PT_MNT_OCT_2024_TOKEN_MAP,
  PENDLE_PT_ORACLE_MAP,
  PENDLE_PT_RETH_JUN_2025_TOKEN_MAP,
  PENDLE_PT_RS_ETH_DEC_2024_TOKEN_MAP,
  PENDLE_PT_RS_ETH_SEP_2024_TOKEN_MAP,
  PENDLE_PT_RS_ETH_TOKEN_MAP,
  PENDLE_PT_USDE_DEC_2024_MAP,
  PENDLE_PT_USDE_JUL_2024_MAP,
  PENDLE_PT_WST_ETH_2024_TOKEN_MAP,
  PENDLE_PT_WST_ETH_2025_TOKEN_MAP,
  PENDLE_ROUTER_MAP,
  PENDLE_ROUTER_V4_MAP, PENDLE_SY_CM_ETH_FEB_2025_TOKEN_MAP,
  PENDLE_SY_EZ_ETH_TOKEN_MAP,
  PENDLE_SY_GLP_MAR_2024_TOKEN_MAP,
  PENDLE_SY_GLP_SEP_2024_TOKEN_MAP,
  PENDLE_SY_IBGT_TOKEN_MAP,
  PENDLE_SY_METH_DEC_2024_TOKEN_MAP,
  PENDLE_SY_MNT_OCT_2024_TOKEN_MAP,
  PENDLE_SY_RETH_TOKEN_MAP,
  PENDLE_SY_RS_ETH_TOKEN_MAP,
  PENDLE_SY_USDE_DEC_2024_MAP,
  PENDLE_SY_USDE_JUL_2024_MAP,
  PENDLE_SY_WE_ETH_TOKEN_MAP,
  PENDLE_SY_WST_ETH_TOKEN_MAP,
  PENDLE_YT_E_ETH_JUN_2024_TOKEN_MAP,
  PENDLE_YT_GLP_MAR_2024_TOKEN_MAP,
  PENDLE_YT_GLP_SEP_2024_TOKEN_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContract } from '../setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

export interface CorePendleEcosystem {
  pendleRouter: IPendleRouter;
  pendleRouterV3: IPendleRouterV3;
}

export interface PendleEcosystemMantle extends CorePendleEcosystem {
  cmEthFeb2025: {
    factory: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    methMarket: IPendlePtMarket;
    ptMethToken: IPendlePtToken;
    syMethToken: IPendleSyToken;
  };
  methDec2024: {
    factory: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    methMarket: IPendlePtMarket;
    ptMethToken: IPendlePtToken;
    syMethToken: IPendleSyToken;
  };
  mntOct2024: {
    factory: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    mntMarket: IPendlePtMarket;
    ptMntToken: IPendlePtToken;
    syMntToken: IPendleSyToken;
  };
  usdeJul2024: {
    factory: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    usdeMarket: IPendlePtMarket;
    ptUSDeToken: IPendlePtToken;
    syUsdeToken: IPendleSyToken;
  };
  usdeDec2024: {
    factory: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    usdeMarket: IPendlePtMarket;
    ptUSDeToken: IPendlePtToken;
    syUsdeToken: IPendleSyToken;
  };
}

export interface PendleEcosystemArbitrumOne extends CorePendleEcosystem {
  ezEthJun2024: {
    dPtEzEthJun2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ezEthMarket: IPendlePtMarket;
    ptEzEthToken: IPendlePtToken;
  };
  ezEthSep2024: {
    dPtEzEthSep2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ezEthMarket: IPendlePtMarket;
    ptEzEthToken: IPendlePtToken;
  };
  glpMar2024: {
    pendleRegistry: IPendleGLPRegistry;
    pendleRegistryProxy: RegistryProxy;
    glpMarket: IPendlePtMarket;
    ptGlpToken: IPendlePtToken;
    ptOracle: IPendlePtOracle;
    ytGlpToken: IPendleYtToken;
    dPtGlpMar2024: PendlePtGLPMar2024IsolationModeVaultFactory;
    dYtGlpMar2024: PendleYtGLPMar2024IsolationModeVaultFactory;
  };
  glpSep2024: {
    dPtGlpSep2024: PendlePtIsolationModeVaultFactory;
    glpMarket: IPendlePtMarket;
    ptGlpToken: IPendlePtToken;
    ptOracle: IPendlePtOracle;
    ytGlpToken: IPendleYtToken;
  };
  rEthJun2025: {
    dPtREthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    rEthMarket: IPendlePtMarket;
    ptREthToken: IPendlePtToken;
  };
  rsEthApr2024: {
    dPtRsEthSep2024: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    rsEthMarket: IPendlePtMarket;
    ptRsEthToken: IPendlePtToken;
  };
  rsEthSep2024: {
    dPtRsEthSep2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    rsEthMarket: IPendlePtMarket;
    ptRsEthToken: IPendlePtToken;
  };
  rsEthDec2024: {
    ptOracle: IPendlePtOracle;
    rsEthMarket: IPendlePtMarket;
    ptRsEthToken: IPendlePtToken;
  };
  weEthApr2024: {
    dPtWeEthApr2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    weEthMarket: IPendlePtMarket;
    ptWeEthToken: IPendlePtToken;
  };
  weEthJun2024: {
    dPtWeEthJun2024: PendlePtIsolationModeVaultFactory;
    ptOracle: IPendlePtOracle;
    weEthMarket: IPendlePtMarket;
    ptWeEthToken: IPendlePtToken;
    ytWeEthToken: IPendleYtToken;
  };
  weEthSep2024: {
    dPtWeEthSep2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    weEthMarket: IPendlePtMarket;
    ptWeEthToken: IPendlePtToken;
  };
  weEthDec2024: {
    ptOracle: IPendlePtOracle;
    weEthMarket: IPendlePtMarket;
    ptWeEthToken: IPendlePtToken;
  };
  wstEthJun2024: {
    dPtWstEthJun2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    wstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  wstEthJun2025: {
    dPtWstEthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    wstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  syEzEthToken: IPendleSyToken;
  syGlpMar2024Token: IPendleSyToken;
  syGlpSep2024Token: IPendleSyToken;
  syREthToken: IPendleSyToken;
  syRsEthToken: IPendleSyToken;
  syWeEthToken: IPendleSyToken;
  syWstEthToken: IPendleSyToken;
}

export interface PendleEcosystemBerachain extends CorePendleEcosystem {
  iBgtDec2025: {
    ptOracle: IPendlePtOracle;
    iBgtMarket: IPendlePtMarket;
    ptIBgtToken: IPendlePtToken;
  };
  syIBgtToken: IPendleSyToken;
}

export async function createPendleEcosystemMantle(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<PendleEcosystemMantle> {
  if (network !== Network.Mantle) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    pendleRouter: getContract(PENDLE_ROUTER_MAP[network] as string, IPendleRouter__factory.connect, signer),
    pendleRouterV3: getContract(PENDLE_ROUTER_V4_MAP[network] as string, IPendleRouterV3__factory.connect, signer),
    cmEthFeb2025: {
      factory: getContract(
        Deployments.PendlePtcmETHFeb2025IsolationModeVaultFactory[network]?.address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      methMarket: getContract(
        PENDLE_MARKET_CM_ETH_FEB_2025_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptMethToken: getContract(
        PENDLE_PT_CM_ETH_FEB_2025_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      syMethToken: getContract(
        PENDLE_SY_CM_ETH_FEB_2025_TOKEN_MAP[network] as string,
        IPendleSyToken__factory.connect,
        signer,
      ),
    },
    methDec2024: {
      factory: getContract(
        Deployments.PendlePtmETHDec2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      methMarket: getContract(
        PENDLE_MARKET_METH_DEC_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptMethToken: getContract(
        PENDLE_PT_METH_DEC_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      syMethToken: getContract(
        PENDLE_SY_METH_DEC_2024_TOKEN_MAP[network] as string,
        IPendleSyToken__factory.connect,
        signer,
      ),
    },
    mntOct2024: {
      factory: getContract(
        Deployments.PendlePtMntOct2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      mntMarket: getContract(
        PENDLE_MARKET_MNT_OCT_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptMntToken: getContract(
        PENDLE_PT_MNT_OCT_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      syMntToken: getContract(
        PENDLE_SY_MNT_OCT_2024_TOKEN_MAP[network] as string,
        IPendleSyToken__factory.connect,
        signer,
      ),
    },
    usdeJul2024: {
      factory: getContract(
        Deployments.PendlePtUSDeJul2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      usdeMarket: getContract(
        PENDLE_MARKET_USDE_JUL_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptUSDeToken: getContract(PENDLE_PT_USDE_JUL_2024_MAP[network] as string, IPendlePtToken__factory.connect, signer),
      syUsdeToken: getContract(PENDLE_SY_USDE_JUL_2024_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    },
    usdeDec2024: {
      factory: getContract(
        Deployments.PendlePtUSDeDec2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      usdeMarket: getContract(
        PENDLE_MARKET_USDE_DEC_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptUSDeToken: getContract(PENDLE_PT_USDE_DEC_2024_MAP[network] as string, IPendlePtToken__factory.connect, signer),
      syUsdeToken: getContract(PENDLE_SY_USDE_DEC_2024_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    },
  };
}

export async function createPendleEcosystemArbitrumOne(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<PendleEcosystemArbitrumOne> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    pendleRouter: getContract(PENDLE_ROUTER_MAP[network] as string, IPendleRouter__factory.connect, signer),
    pendleRouterV3: getContract(PENDLE_ROUTER_V4_MAP[network] as string, IPendleRouterV3__factory.connect, signer),
    ezEthJun2024: {
      dPtEzEthJun2024: getContract(
        deployments.PendlePtEzETHJun2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleEzETHJun2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      ezEthMarket: getContract(
        PENDLE_MARKET_EZ_ETH_JUN_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptEzEthToken: getContract(
        PENDLE_PT_EZ_ETH_JUN_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    ezEthSep2024: {
      dPtEzEthSep2024: getContract(
        deployments.PendlePtEzETHSep2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        Deployments.PendleEzETHSep2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      ezEthMarket: getContract(
        PENDLE_MARKET_EZ_ETH_SEP_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptEzEthToken: getContract(
        PENDLE_PT_EZ_ETH_SEP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    glpMar2024: {
      pendleRegistry: getContract(
        Deployments.PendleGLPMar2024RegistryProxy[network].address,
        IPendleGLPRegistry__factory.connect,
        signer,
      ),
      pendleRegistryProxy: getContract(
        Deployments.PendleGLPMar2024RegistryProxy[network].address,
        RegistryProxy__factory.connect,
        signer,
      ),
      glpMarket: getContract(
        PENDLE_MARKET_GLP_MAR_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptGlpToken: getContract(
        PENDLE_PT_GLP_MAR_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      ytGlpToken: getContract(
        PENDLE_YT_GLP_MAR_2024_TOKEN_MAP[network] as string,
        IPendleYtToken__factory.connect,
        signer,
      ),
      dPtGlpMar2024: getContract(
        Deployments.PendlePtGLPMar2024IsolationModeVaultFactory[network].address,
        PendlePtGLPMar2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
      dYtGlpMar2024: getContract(
        Deployments.PendleYtGLPMar2024IsolationModeVaultFactory[network].address,
        PendleYtGLPMar2024IsolationModeVaultFactory__factory.connect,
        signer,
      ),
    },
    glpSep2024: {
      dPtGlpSep2024: getContract(
        Deployments.PendlePtGLPSep2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      glpMarket: getContract(
        PENDLE_MARKET_GLP_SEP_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptGlpToken: getContract(
        PENDLE_PT_GLP_SEP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      ytGlpToken: getContract(
        PENDLE_YT_GLP_SEP_2024_TOKEN_MAP[network] as string,
        IPendleYtToken__factory.connect,
        signer,
      ),
    },
    rEthJun2025: {
      dPtREthJun2025: getContract(
        deployments.PendlePtREthJun2025IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleREthJun2025RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      rEthMarket: getContract(
        PENDLE_MARKET_RETH_JUN_2025_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptREthToken: getContract(
        PENDLE_PT_RETH_JUN_2025_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    rsEthApr2024: {
      dPtRsEthSep2024: getContract(
        Deployments.PendlePtRsETHSep2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      rsEthMarket: getContract(
        PENDLE_MARKET_RS_ETH_APR_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptRsEthToken: getContract(PENDLE_PT_RS_ETH_TOKEN_MAP[network] as string, IPendlePtToken__factory.connect, signer),
    },
    rsEthSep2024: {
      dPtRsEthSep2024: getContract(
        deployments.PendlePtRsETHSep2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        Deployments.PendleRsETHSep2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      rsEthMarket: getContract(
        PENDLE_MARKET_RS_ETH_SEP_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptRsEthToken: getContract(
        PENDLE_PT_RS_ETH_SEP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    rsEthDec2024: {
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      rsEthMarket: getContract(
        PENDLE_MARKET_RS_ETH_DEC_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptRsEthToken: getContract(
        PENDLE_PT_RS_ETH_DEC_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    weEthApr2024: {
      dPtWeEthApr2024: getContract(
        deployments.PendlePtWeETHApr2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWeETHApr2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      weEthMarket: getContract(
        PENDLE_MARKET_E_ETH_APR_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWeEthToken: getContract(
        PENDLE_PT_E_ETH_APR_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    weEthJun2024: {
      dPtWeEthJun2024: getContract(
        Deployments.PendlePtWeETHJun2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      weEthMarket: getContract(
        PENDLE_MARKET_E_ETH_JUN_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWeEthToken: getContract(
        PENDLE_PT_E_ETH_JUN_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
      ytWeEthToken: getContract(
        PENDLE_YT_E_ETH_JUN_2024_TOKEN_MAP[network] as string,
        IPendleYtToken__factory.connect,
        signer,
      ),
    },
    weEthSep2024: {
      dPtWeEthSep2024: getContract(
        deployments.PendlePtWeETHSep2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        Deployments.PendleWeETHSep2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      weEthMarket: getContract(
        PENDLE_MARKET_E_ETH_SEP_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWeEthToken: getContract(
        PENDLE_PT_E_ETH_SEP_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    weEthDec2024: {
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      weEthMarket: getContract(
        PENDLE_MARKET_E_ETH_DEC_2024_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWeEthToken: getContract(
        PENDLE_PT_E_ETH_DEC_2024_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    wstEthJun2024: {
      dPtWstEthJun2024: getContract(
        deployments.PendlePtWstEthJun2024IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2024RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      wstEthMarket: getContract(
        PENDLE_MARKET_WST_ETH_2024_MAP[network] as string,
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
        deployments.PendlePtWstEthJun2025IsolationModeVaultFactory[network].address,
        PendlePtIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      pendleRegistry: getContract(
        deployments.PendleWstEthJun2025RegistryProxy[network].address,
        IPendleRegistry__factory.connect,
        signer,
      ),
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      wstEthMarket: getContract(
        PENDLE_MARKET_WST_ETH_2025_MAP[network] as string,
        IPendlePtMarket__factory.connect,
        signer,
      ),
      ptWstEthToken: getContract(
        PENDLE_PT_WST_ETH_2025_TOKEN_MAP[network] as string,
        IPendlePtToken__factory.connect,
        signer,
      ),
    },
    syEzEthToken: getContract(PENDLE_SY_EZ_ETH_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    syGlpMar2024Token: getContract(
      PENDLE_SY_GLP_MAR_2024_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syGlpSep2024Token: getContract(
      PENDLE_SY_GLP_SEP_2024_TOKEN_MAP[network] as string,
      IPendleSyToken__factory.connect,
      signer,
    ),
    syREthToken: getContract(PENDLE_SY_RETH_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    syRsEthToken: getContract(PENDLE_SY_RS_ETH_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    syWeEthToken: getContract(PENDLE_SY_WE_ETH_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
    syWstEthToken: getContract(PENDLE_SY_WST_ETH_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
  };
}

export async function createPendleEcosystemBerachain(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<PendleEcosystemBerachain> {
  if (network !== Network.Berachain) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    pendleRouter: getContract(PENDLE_ROUTER_MAP[network] as string, IPendleRouter__factory.connect, signer),
    pendleRouterV3: getContract(PENDLE_ROUTER_V4_MAP[network] as string, IPendleRouterV3__factory.connect, signer),
    iBgtDec2025: {
      ptOracle: getContract(PENDLE_PT_ORACLE_MAP[network] as string, IPendlePtOracle__factory.connect, signer),
      iBgtMarket: getContract(PENDLE_MARKET_IBGT_DEC_2025_MAP[network] as string, IPendlePtMarket__factory.connect, signer),
      ptIBgtToken: getContract(PENDLE_PT_IBGT_DEC_2025_TOKEN_MAP[network] as string, IPendlePtToken__factory.connect, signer),
    },
    syIBgtToken: getContract(PENDLE_SY_IBGT_TOKEN_MAP[network] as string, IPendleSyToken__factory.connect, signer),
  };
}
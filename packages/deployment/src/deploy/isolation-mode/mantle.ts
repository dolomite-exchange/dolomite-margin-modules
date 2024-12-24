import {
  D_ARB_MAP,
  D_GLV_BTC_MAP,
  D_GLV_ETH_MAP,
  D_GM_AAVE_USD_MAP,
  D_GM_ARB_USD_MAP,
  D_GM_BTC_MAP,
  D_GM_BTC_USD_MAP,
  D_GM_DOGE_USD_MAP,
  D_GM_ETH_MAP,
  D_GM_ETH_USD_MAP,
  D_GM_GMX_MAP,
  D_GM_GMX_USD_MAP,
  D_GM_LINK_USD_MAP,
  D_GM_PENDLE_USD_MAP,
  D_GM_PEPE_USD_MAP,
  D_GM_SOL_USD_MAP,
  D_GM_UNI_USD_MAP,
  D_GM_WIF_MAP,
  D_GM_WST_ETH_USD_MAP,
  D_GMX_MAP,
  DFS_GLP_MAP,
  DJ_USDC_V1,
  DJ_USDC_V2,
  DPLV_GLP_MAP,
  DPT_EZ_ETH_JUN_2024_MAP,
  DPT_EZ_ETH_SEP_2024_MAP,
  DPT_GLP_MAR_2024_MAP,
  DPT_GLP_SEP_2024_MAP,
  DPT_R_ETH_JUN_2025_MAP,
  DPT_RS_ETH_DEC_2024_MAP,
  DPT_RS_ETH_SEP_2024_MAP,
  DPT_WE_ETH_APR_2024_MAP,
  DPT_WE_ETH_DEC_2024_MAP,
  DPT_WE_ETH_JUN_2024_MAP,
  DPT_WE_ETH_SEP_2024_MAP,
  DPT_WST_ETH_JUN_2024_MAP,
  DPT_WST_ETH_JUN_2025_MAP,
  DYT_GLP_2024_MAP,
} from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../../utils/deploy-utils';
import {
  DeployedVaultInformation,
  getConstructorParametersForAsyncIsolationMode, getIsolationModeLibrariesByType,
  IsolationModeVaultType,
} from './isolation-mode-helpers';

const network = Network.Mantle;

export const marketToIsolationModeVaultInfoMantle: Record<number, DeployedVaultInformation> = {
  [DFS_GLP_MAP[network].marketId]: {
    contractName: 'GLPIsolationModeTokenVaultV2',
    contractRenameWithoutVersion: 'GLPIsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey('GLPIsolationModeTokenVault', network),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.None),
    vaultType: IsolationModeVaultType.None,
  },
};

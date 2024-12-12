import { D_ARB_MAP, D_GM_LINK_USD_MAP, DFS_GLP_MAP, DPT_R_ETH_JUN_2025_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../../utils/deploy-utils';
import {
  DeployedVaultInformation,
  getConstructorParametersForAsyncIsolationMode,
  IsolationModeLibraryNames,
  IsolationModeVaultType,
} from './isolation-mode-helpers';

const network = Network.ArbitrumOne;

export const marketToIsolationModeVaultInfoArbitrumOne: Record<number, DeployedVaultInformation> = {
  [DFS_GLP_MAP[network].marketId]: {
    contractName: 'GLPIsolationModeTokenVaultV2',
    contractRenameWithoutVersion: 'GLPIsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'GLPIsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl],
    vaultType: IsolationModeVaultType.None,
  },
  [DPT_R_ETH_JUN_2025_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtREthJun2025IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtREthJun2025IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl],
    vaultType: IsolationModeVaultType.Pt,
  },
  [D_ARB_MAP[network].marketId]: {
    contractName: 'ARBIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'ARBIsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'ARBIsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl],
    vaultType: IsolationModeVaultType.None,
  },
  [D_GM_LINK_USD_MAP[network].marketId]: {
    contractName: 'GmxV2IsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'GmxV2IsolationModeTokenVaultImplementation',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'GmxV2IsolationModeTokenVaultImplementation',
      network,
    ),
    constructorParams: getConstructorParametersForAsyncIsolationMode(network),
    libraries: [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl, IsolationModeLibraryNames.GmxV2Library],
    vaultType: IsolationModeVaultType.GmxV2,
  },
};

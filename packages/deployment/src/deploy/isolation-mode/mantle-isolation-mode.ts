import {
  D_MNT_MAP,
  DPT_CM_ETH_FEB_2025_MAP,
  DPT_METH_DEC_2024_MAP,
  DPT_MNT_OCT_2024_MAP,
  DPT_USDE_DEC_2024_MAP,
  DPT_USDE_JUL_2024_MAP,
} from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../../utils/deploy-utils';
import {
  DeployedVaultInformation,
  getIsolationModeLibrariesByType,
  IsolationModeVaultType,
} from './isolation-mode-helpers';

const network = Network.Mantle;

export const marketToIsolationModeVaultInfoMantle: Record<number, DeployedVaultInformation> = {
  [DPT_USDE_JUL_2024_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtUSDeJul2024IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtUSDeJul2024IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.Pt),
    vaultType: IsolationModeVaultType.Pt,
    tokenAddress: DPT_USDE_JUL_2024_MAP[network].address,
  },
  [DPT_USDE_DEC_2024_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtUSDeDec2024IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtUSDeDec2024IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.Pt),
    vaultType: IsolationModeVaultType.Pt,
    tokenAddress: DPT_USDE_DEC_2024_MAP[network].address,
  },
  [DPT_METH_DEC_2024_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtmETHDec2024IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtmETHDec2024IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.Pt),
    vaultType: IsolationModeVaultType.Pt,
    tokenAddress: DPT_METH_DEC_2024_MAP[network].address,
  },
  [DPT_MNT_OCT_2024_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtMntOct2024IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtMntOct2024IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.Pt),
    vaultType: IsolationModeVaultType.Pt,
    tokenAddress: DPT_MNT_OCT_2024_MAP[network].address,
  },
  [DPT_CM_ETH_FEB_2025_MAP[network].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtcmETHFeb2025IsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'PendlePtcmETHFeb2025IsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.Pt),
    vaultType: IsolationModeVaultType.Pt,
    tokenAddress: DPT_CM_ETH_FEB_2025_MAP[network].address,
  },
  [D_MNT_MAP[network].marketId]: {
    contractName: 'MNTIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'WMNTIsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'MNTIsolationModeTokenVault',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.None),
    vaultType: IsolationModeVaultType.None,
    tokenAddress: D_MNT_MAP[network].address,
  },
};

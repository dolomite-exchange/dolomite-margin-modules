import { D_ARB_MAP, D_GM_LINK_USD_MAP, DFS_GLP_MAP, DPT_R_ETH_JUN_2025_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';

export enum IsolationModeVaultType {
  None = 0,
  Pt = 1,
  Yt = 2,
  GmxV2 = 3,
  GLV = 4,
  BerachainRewardVault = 5,
}

export interface DeployedVaultInformation {
  contractName: string;
  contractRenameWithoutVersion: string;
  implementationAddress: string;
  constructorParams: any[];
  libraries: string[];
  vaultType: IsolationModeVaultType;
}

export const marketToIsolationModeVaultInfoArbitrumOne: Record<number, DeployedVaultInformation> = {
  [DFS_GLP_MAP[Network.ArbitrumOne].marketId]: {
    contractName: 'GLPIsolationModeTokenVaultV2',
    contractRenameWithoutVersion: 'GLPIsolationModeTokenVault',
    implementationAddress: '0x56359da5151AB4B12370690a4E81ea09Ae6Ad212',
    constructorParams: [],
    libraries: [
      'IsolationModeTokenVaultV1ActionsImpl'
    ],
    vaultType: IsolationModeVaultType.None,
  },
  [DPT_R_ETH_JUN_2025_MAP[Network.ArbitrumOne].marketId]: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'PendlePtREthJun2025IsolationModeTokenVault',
    implementationAddress: '0xE47C41C33C198676F0998b9c7d8f3e5fd10e46D9',
    constructorParams: [],
    libraries: [
      'IsolationModeTokenVaultV1ActionsImpl'
    ],
    vaultType: IsolationModeVaultType.Pt,
  },
  [D_ARB_MAP[Network.ArbitrumOne].marketId]: {
    contractName: 'ARBIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'ARBIsolationModeTokenVault',
    implementationAddress: '0x44122d653D5E2d2AC1F8C684093C22318748B99E',
    constructorParams: [],
    libraries: [
      'IsolationModeTokenVaultV1ActionsImpl'
    ],
    vaultType: IsolationModeVaultType.None,
  },
  [D_GM_LINK_USD_MAP[Network.ArbitrumOne].marketId]: {
    contractName: 'GmxV2IsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'GmxV2IsolationModeTokenVaultImplementation',
    implementationAddress: '0x818f986eDc9A208497206f816e4F6042d3440fB1',
    constructorParams: ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 42161],
    libraries: [
      'IsolationModeTokenVaultV1ActionsImpl',
      'GmxV2Library'
    ],
    vaultType: IsolationModeVaultType.GmxV2,
  }
};

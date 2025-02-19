import { PAYABLE_TOKEN_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';

export function getConstructorParametersForAsyncIsolationMode(network: Network): any[] {
  return [PAYABLE_TOKEN_MAP[network].address, network];
}

export enum IsolationModeVaultType {
  None = 'None',
  Migrator = 'Migrator',
  Pt = 'Pt',
  Yt = 'Yt',
  GmxV2 = 'GmxV2',
  GLV = 'GLV',
  BerachainRewardVault = 'BerachainRewardVault',
}

export interface DeployedVaultInformation {
  contractName: string;
  contractRenameWithoutVersion: string;
  implementationAddress: string;
  constructorParams: any[];
  libraries: IsolationModeLibraryNames[];
  vaultType: IsolationModeVaultType;
  defaultVersion?: number;
}

export enum IsolationModeLibraryNames {
  IsolationModeTokenVaultV1ActionsImpl = 'IsolationModeTokenVaultV1ActionsImpl',
  GlvLibrary = 'GlvLibrary',
  GmxV2Library = 'GmxV2Library',
}

export function getIsolationModeLibrariesByType(vaultType: IsolationModeVaultType): IsolationModeLibraryNames[] {
  if (vaultType === IsolationModeVaultType.None) {
    return [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl];
  }
  if (vaultType === IsolationModeVaultType.Migrator) {
    return [];
  }
  if (vaultType === IsolationModeVaultType.Pt) {
    return [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl];
  }
  if (vaultType === IsolationModeVaultType.Yt) {
    return [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl];
  }
  if (vaultType === IsolationModeVaultType.GmxV2) {
    return [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl, IsolationModeLibraryNames.GmxV2Library];
  }
  if (vaultType === IsolationModeVaultType.GLV) {
    return [
      IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl,
      IsolationModeLibraryNames.GmxV2Library,
      IsolationModeLibraryNames.GlvLibrary,
    ];
  }

  throw new Error(`Unknown vault type, found ${vaultType}`);
}

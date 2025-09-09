import { PAYABLE_TOKEN_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';

export function getConstructorParametersForAsyncIsolationMode(network: Network): any[] {
  return [PAYABLE_TOKEN_MAP[network].address, network];
}

export enum IsolationModeVaultType {
  None = 'None',
  BerachainPol = 'BerachainPol',
  GLV = 'GLV',
  GmxV2 = 'GmxV2',
  Migrator = 'Migrator',
  Pt = 'Pt',
  Yt = 'Yt',
}

export interface DeployedVaultInformation {
  contractName: string;
  contractRenameWithoutVersion: string;
  implementationAddress: string;
  constructorParams: any[];
  libraries: IsolationModeLibraryNames[];
  vaultType: IsolationModeVaultType;
  tokenAddress: string;
  defaultVersion?: number;
}

export enum IsolationModeLibraryNames {
  IsolationModeTokenVaultV1ActionsImpl = 'IsolationModeTokenVaultV1ActionsImpl',
  AsyncIsolationModeTokenVaultV1ActionsImpl = 'AsyncIsolationModeTokenVaultV1ActionsImpl',
  GlvLibrary = 'GlvLibrary',
  GmxV2TraderLibrary = 'GmxV2TraderLibrary',
  GmxV2VaultLibrary = 'GmxV2VaultLibrary',
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
    return [
      IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl,
      IsolationModeLibraryNames.AsyncIsolationModeTokenVaultV1ActionsImpl,
      IsolationModeLibraryNames.GmxV2VaultLibrary,
    ];
  }
  if (vaultType === IsolationModeVaultType.GLV) {
    return [
      IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl,
      IsolationModeLibraryNames.AsyncIsolationModeTokenVaultV1ActionsImpl,
      IsolationModeLibraryNames.GmxV2VaultLibrary,
      IsolationModeLibraryNames.GlvLibrary,
    ];
  }

  throw new Error(`Unknown vault type, found ${vaultType}`);
}

import { D_IBGT_MAP, POL_R_USD_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../../utils/deploy-utils';
import {
  DeployedVaultInformation,
  getIsolationModeLibrariesByType,
  IsolationModeVaultType,
} from './isolation-mode-helpers';

const network = Network.Berachain;

export const marketToIsolationModeVaultInfoBerachain: Record<number, DeployedVaultInformation> = {
  [D_IBGT_MAP[network].marketId]: {
    contractName: 'InfraredBGTIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'InfraredBGTIsolationModeTokenVault',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey('InfraredBGTIsolationModeTokenVault', network),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.None),
    vaultType: IsolationModeVaultType.None,
    tokenAddress: D_IBGT_MAP[network].address,
  },
  [POL_R_USD_MAP[network].marketId]: {
    contractName: 'POLIsolationModeTokenVaultV1',
    contractRenameWithoutVersion: 'POLIsolationModeTokenVaultImplementation',
    implementationAddress: getMaxDeploymentVersionAddressByDeploymentKey(
      'POLIsolationModeTokenVaultImplementation',
      network,
    ),
    constructorParams: [],
    libraries: getIsolationModeLibrariesByType(IsolationModeVaultType.None),
    vaultType: IsolationModeVaultType.BerachainPol,
    tokenAddress: POL_R_USD_MAP[network].address,
  },
};

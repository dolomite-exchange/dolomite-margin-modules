import { D_IBGT_MAP, POL_R_USD_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../../utils/deploy-utils';
import {
  DeployedVaultInformation,
  getIsolationModeLibrariesByType,
  IsolationModeVaultType,
} from './isolation-mode-helpers';

const network = Network.Botanix;

export const marketToIsolationModeVaultInfoBotanix: Record<number, DeployedVaultInformation> = {};

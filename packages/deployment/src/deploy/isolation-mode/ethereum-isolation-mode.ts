import { Network } from 'packages/base/src/utils/no-deps-constants';
import { DeployedVaultInformation } from './isolation-mode-helpers';

const network = Network.Ethereum;

export const marketToIsolationModeVaultInfoEthereum: Record<number, DeployedVaultInformation> = {};

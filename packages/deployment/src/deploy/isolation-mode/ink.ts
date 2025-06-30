import { Network } from 'packages/base/src/utils/no-deps-constants';
import { DeployedVaultInformation } from './isolation-mode-helpers';

const network = Network.Ink;

export const marketToIsolationModeVaultInfoInk: Record<number, DeployedVaultInformation> = {};

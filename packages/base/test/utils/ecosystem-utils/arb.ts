import {
  ARBIsolationModeVaultFactory__factory,
  ARBRegistry__factory,
  IARB,
  IARB__factory,
  IARBIsolationModeVaultFactory,
  IARBRegistry,
} from '@dolomite-exchange/modules-arb/src/types';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { RegistryProxy, RegistryProxy__factory } from '../../../src/types';
import { ARB_MAP } from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContract } from '../setup';

export interface ArbEcosystem {
  arb: IARB;
  live: {
    dArb: IARBIsolationModeVaultFactory;
    arbRegistry: IARBRegistry;
    arbRegistryProxy: RegistryProxy;
  };
}

export async function createArbEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<ArbEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    arb: getContract(ARB_MAP[network]?.address as string, IARB__factory.connect, signer),
    live: {
      dArb: getContract(
        (Deployments.ARBIsolationModeVaultFactory as any)[network].address,
        ARBIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      arbRegistry: getContract(
        (Deployments.ARBRegistryProxy as any)[network].address,
        ARBRegistry__factory.connect,
        signer,
      ),
      arbRegistryProxy: getContract(
        (Deployments.ARBRegistryProxy as any)[network].address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

import { IEnsoRouter, IEnsoRouter__factory } from '../../../src/types';
import { ENSO_ROUTER_MAP } from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface EnsoEcosystem {
  router: IEnsoRouter;
}

export async function createEnsoEcosystem(
  network: Network.Ethereum | Network.Berachain,
  signer: SignerWithAddressWithSafety,
): Promise<EnsoEcosystem> {
  return {
    router: IEnsoRouter__factory.connect(ENSO_ROUTER_MAP[network], signer),
  };
}

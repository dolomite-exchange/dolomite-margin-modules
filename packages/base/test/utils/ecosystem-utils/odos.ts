import { IOdosRouter, IOdosRouter__factory } from '../../../src/types';
import { ODOS_ROUTER_MAP } from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface OdosEcosystem {
  odosRouter: IOdosRouter;
}

export async function createOdosEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<OdosEcosystem> {
  if (!ODOS_ROUTER_MAP[network]) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    odosRouter: IOdosRouter__factory.connect(ODOS_ROUTER_MAP[network]!, signer),
  };
}

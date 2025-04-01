import { IOogaBoogaRouter, IOogaBoogaRouter__factory } from 'packages/base/src/types';
import { OOGA_BOOGA_ROUTER_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';

export interface OogaBoogaEcosystem {
  oogaBoogaRouter: IOogaBoogaRouter;
}

export async function createOogaBoogaEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<OogaBoogaEcosystem> {
  if (network !== Network.Berachain) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    oogaBoogaRouter: IOogaBoogaRouter__factory.connect(OOGA_BOOGA_ROUTER_MAP[network]!, signer),
  };
}

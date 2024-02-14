import { IOdosRouter, IOdosRouter__factory, } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ODOS_ROUTER_MAP } from '../../../src/utils/constants';

export interface OdosEcosystem {
  odosRouter: IOdosRouter;
}

export async function createOdosEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<OdosEcosystem> {
  if (!ODOS_ROUTER_MAP[network]) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    odosRouter: IOdosRouter__factory.connect(ODOS_ROUTER_MAP[network]!, signer),
  };
}

import { IERC4626, IERC4626__factory } from '../../../src/types';
import { MAGIC_GLP_MAP } from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { getContract } from '../setup';

export interface AbraEcosystem {
  magicGlp: IERC4626;
}

export async function createAbraEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<AbraEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    magicGlp: getContract(MAGIC_GLP_MAP[network]?.address as string, IERC4626__factory.connect, signer),
  };
}

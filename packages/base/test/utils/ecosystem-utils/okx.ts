import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface OkxEcosystem {
}

export async function createOkxEcosystem(
  network: Network.XLayer,
  signer: SignerWithAddressWithSafety,
): Promise<OkxEcosystem> {
  return {};
}

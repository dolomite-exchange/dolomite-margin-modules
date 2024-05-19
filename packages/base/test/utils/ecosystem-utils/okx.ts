import { BaseContract } from 'ethers';
import { IParaswapAugustusRouter__factory } from '../../../src/types';
import { OKX_DEX_ROUTER_MAP, OKX_DEX_TRANSFER_PROXY_MAP } from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface OkxEcosystem {
  dexRouter: BaseContract;
  transferProxy: BaseContract;
}

export async function createOkxEcosystem(
  network: Network.XLayer,
  signer: SignerWithAddressWithSafety,
): Promise<OkxEcosystem> {
  return {
    dexRouter: IParaswapAugustusRouter__factory.connect(OKX_DEX_ROUTER_MAP[network], signer),
    transferProxy: IParaswapAugustusRouter__factory.connect(OKX_DEX_TRANSFER_PROXY_MAP[network], signer),
  };
}

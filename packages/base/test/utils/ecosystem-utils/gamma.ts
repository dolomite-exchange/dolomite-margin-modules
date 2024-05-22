import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { Network } from "packages/base/src/utils/no-deps-constants";
import { IDeltaSwapFactory, IDeltaSwapFactory__factory, IGammaPool, IGammaPool__factory } from "packages/gamma/src/types";
import { getContract } from "../setup";
import { DELTA_SWAP_FACTORY_MAP, GAMMA_POOL_WETH_USDC_MAP } from "packages/base/src/utils/constants";

export interface GammaEcosystem {
  deltaSwapFactory: IDeltaSwapFactory;
  gammaPools: {
    wethUsdc: IGammaPool;
  }
}

export async function createGammaEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<GammaEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    deltaSwapFactory: getContract(DELTA_SWAP_FACTORY_MAP[network], IDeltaSwapFactory__factory.connect, signer),
    gammaPools: {
      wethUsdc: getContract(
        GAMMA_POOL_WETH_USDC_MAP[network], IGammaPool__factory.connect, signer),
    },
  };
}
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { Network } from "packages/base/src/utils/no-deps-constants";
import {
  IDeltaSwapFactory,
  IDeltaSwapFactory__factory,
  IDeltaSwapRouter,
  IDeltaSwapRouter__factory,
  IGammaPool,
  IGammaPool__factory,
  IGammaPositionManager,
  IGammaPositionManager__factory
} from "packages/gamma/src/types";
import { getContract } from "../setup";
import { DELTA_SWAP_FACTORY_MAP, DELTA_SWAP_ROUTER_MAP, GAMMA_POOL_WETH_USDC_MAP, GAMMA_POSITION_MANAGER_MAP } from "packages/base/src/utils/constants";

export interface GammaEcosystem {
  deltaSwapFactory: IDeltaSwapFactory;
  deltaSwapRouter: IDeltaSwapRouter;
  gammaPools: {
    wethUsdc: IGammaPool;
  }
  positionManager: IGammaPositionManager;
}

export async function createGammaEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<GammaEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    deltaSwapFactory: getContract(DELTA_SWAP_FACTORY_MAP[network], IDeltaSwapFactory__factory.connect, signer),
    deltaSwapRouter: getContract(DELTA_SWAP_ROUTER_MAP[network], IDeltaSwapRouter__factory.connect, signer),
    gammaPools: {
      wethUsdc: getContract(
        GAMMA_POOL_WETH_USDC_MAP[network], IGammaPool__factory.connect, signer),
    },
    positionManager: getContract(GAMMA_POSITION_MANAGER_MAP[network], IGammaPositionManager__factory.connect, signer)
  };
}
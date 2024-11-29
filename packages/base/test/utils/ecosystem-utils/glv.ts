import { BigNumberish } from 'ethers';
import { IERC20__factory } from 'packages/base/src/types';
import {
  GLV_HANDLER_MAP,
  GLV_READER_MAP,
  GLV_ROUTER_MAP,
  GLV_TOKEN_WBTC_USDC_MAP,
  GLV_TOKEN_WETH_USDC_MAP,
  GLV_VAULT_MAP,
  NATIVE_USDC_MAP,
  WBTC_MAP,
  WETH_MAP,
} from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import {
  IERC20,
  IGlvHandler,
  IGlvHandler__factory,
  IGlvReader,
  IGlvReader__factory,
  IGlvRouter,
  IGlvRouter__factory,
  IGlvToken,
  IGlvToken__factory,
} from 'packages/glv/src/types';
import { getContract } from '../setup';

export interface GlvToken {
  glvToken: IGlvToken;
  longToken: IERC20;
  shortToken: IERC20;
  longMarketId: BigNumberish;
  shortMarketId: BigNumberish;
}

export interface GlvEcosystem {
  glvHandler: IGlvHandler;
  glvReader: IGlvReader;
  glvRouter: IGlvRouter;
  glvTokens: {
    wbtcUsdc: GlvToken;
    wethUsdc: GlvToken;
  };
  glvVault: { address: string };
}

export async function createGlvEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<GlvEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    glvHandler: getContract(GLV_HANDLER_MAP[network], IGlvHandler__factory.connect, signer),
    glvReader: getContract(GLV_READER_MAP[network], IGlvReader__factory.connect, signer),
    glvRouter: getContract(GLV_ROUTER_MAP[network], IGlvRouter__factory.connect, signer),
    glvTokens: {
      wbtcUsdc: {
        glvToken: getContract(GLV_TOKEN_WBTC_USDC_MAP[network], IGlvToken__factory.connect, signer),
        longToken: IERC20__factory.connect(WBTC_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WBTC_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      wethUsdc: {
        glvToken: getContract(GLV_TOKEN_WETH_USDC_MAP[network], IGlvToken__factory.connect, signer),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
    },
    glvVault: { address: GLV_VAULT_MAP[network] },
  };
}

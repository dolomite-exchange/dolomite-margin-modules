import { BigNumberish } from 'ethers';
import {
  IERC20__factory,
  IsolationModeTraderProxy, IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from 'packages/base/src/types';
import {
  GLV_DEPOSIT_HANDLER_MAP,
  GLV_HANDLER_MAP,
  GLV_READER_MAP,
  GLV_ROUTER_MAP,
  GLV_TOKEN_WBTC_USDC_MAP,
  GLV_TOKEN_WETH_USDC_MAP,
  GLV_VAULT_MAP,
  GLV_WITHDRAWAL_HANDLER_MAP,
  NATIVE_USDC_MAP,
  WBTC_MAP,
  WETH_MAP,
} from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeTokenVaultV1__factory,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeUnwrapperTraderV2__factory, GlvIsolationModeVaultFactory, GlvIsolationModeVaultFactory__factory,
  GlvIsolationModeWrapperTraderV2,
  GlvIsolationModeWrapperTraderV2__factory,
  GlvRegistry,
  GlvRegistry__factory,
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
import { getContract, getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

export interface GlvToken {
  glvToken: IGlvToken;
  longToken: IERC20;
  shortToken: IERC20;
  longMarketId: BigNumberish;
  shortMarketId: BigNumberish;
}

export interface GlvEcosystem {
  glvDepositHandler: IGlvHandler;
  glvWithdrawalHandler: IGlvHandler;
  glvHandler: IGlvHandler;
  glvReader: IGlvReader;
  glvRouter: IGlvRouter;
  glvTokens: {
    wbtcUsdc: GlvToken;
    wethUsdc: GlvToken;
  };
  glvVault: { address: string };
  live: {
    glvBtc: {
      factory: GlvIsolationModeVaultFactory;
      unwrapper: GlvIsolationModeUnwrapperTraderV2;
      unwrapperProxy: IsolationModeTraderProxy;
      wrapper: GlvIsolationModeWrapperTraderV2;
      wrapperProxy: IsolationModeTraderProxy;
    };
    glvEth: {
      factory: GlvIsolationModeVaultFactory;
      unwrapper: GlvIsolationModeUnwrapperTraderV2;
      unwrapperProxy: IsolationModeTraderProxy;
      wrapper: GlvIsolationModeWrapperTraderV2;
      wrapperProxy: IsolationModeTraderProxy;
    };
    glvLibraryMap: { GlvLibrary: string };
    registry: GlvRegistry;
    registryProxy: RegistryProxy;
    tokenVaultImplementation: GlvIsolationModeTokenVaultV1;
    unwrapperImplementation: GlvIsolationModeUnwrapperTraderV2;
    wrapperImplementation: GlvIsolationModeWrapperTraderV2;
  };
}

export async function createGlvEcosystem(network: Network, signer: SignerWithAddressWithSafety): Promise<GlvEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const glvLibraryAddress = getMaxDeploymentVersionAddressByDeploymentKey('GlvLibrary', network);
  const tokenVaultImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GlvIsolationModeTokenVaultImplementation',
    network,
  );
  const unwrapperImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GlvIsolationModeUnwrapperTraderImplementation',
    network,
  );
  const wrapperImplementationAddress = getMaxDeploymentVersionAddressByDeploymentKey(
    'GlvIsolationModeWrapperTraderImplementation',
    network,
  );

  return {
    glvDepositHandler: getContract(GLV_DEPOSIT_HANDLER_MAP[network], IGlvHandler__factory.connect, signer),
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
    glvWithdrawalHandler: getContract(GLV_WITHDRAWAL_HANDLER_MAP[network], IGlvHandler__factory.connect, signer),
    live: {
      glvBtc: {
        factory: GlvIsolationModeVaultFactory__factory.connect(
          Deployments.GlvBTCV2IsolationModeVaultFactory[network].address,
          signer,
        ),
        unwrapper: GlvIsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GlvBTCV2AsyncIsolationModeUnwrapperTraderProxyV2[network].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GlvBTCV2AsyncIsolationModeUnwrapperTraderProxyV2[network].address,
          signer,
        ),
        wrapper: GlvIsolationModeWrapperTraderV2__factory.connect(
          Deployments.GlvBTCV2AsyncIsolationModeWrapperTraderProxyV2[network].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GlvBTCV2AsyncIsolationModeWrapperTraderProxyV2[network].address,
          signer,
        ),
      },
      glvEth: {
        factory: GlvIsolationModeVaultFactory__factory.connect(
          Deployments.GlvETHIsolationModeVaultFactory[network].address,
          signer,
        ),
        unwrapper: GlvIsolationModeUnwrapperTraderV2__factory.connect(
          Deployments.GlvETHAsyncIsolationModeUnwrapperTraderProxyV2[network].address,
          signer,
        ),
        unwrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GlvETHAsyncIsolationModeUnwrapperTraderProxyV2[network].address,
          signer,
        ),
        wrapper: GlvIsolationModeWrapperTraderV2__factory.connect(
          Deployments.GlvETHAsyncIsolationModeWrapperTraderProxyV2[network].address,
          signer,
        ),
        wrapperProxy: IsolationModeTraderProxy__factory.connect(
          Deployments.GlvETHAsyncIsolationModeWrapperTraderProxyV2[network].address,
          signer,
        ),
      },
      glvLibraryMap: { GlvLibrary: glvLibraryAddress },
      registry: GlvRegistry__factory.connect(Deployments.GlvRegistryProxy['42161'].address, signer),
      registryProxy: RegistryProxy__factory.connect(Deployments.GlvRegistryProxy['42161'].address, signer),
      tokenVaultImplementation: GlvIsolationModeTokenVaultV1__factory.connect(tokenVaultImplementationAddress, signer),
      unwrapperImplementation: GlvIsolationModeUnwrapperTraderV2__factory.connect(
        unwrapperImplementationAddress,
        signer,
      ),
      wrapperImplementation: GlvIsolationModeWrapperTraderV2__factory.connect(wrapperImplementationAddress, signer),
    },
  };
}

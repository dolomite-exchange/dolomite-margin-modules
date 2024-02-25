import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  IEsGmxDistributor,
  IEsGmxDistributor__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGLPIsolationModeVaultFactoryOld__factory,
  IGLPManager,
  IGLPManager__factory,
  IGLPRewardsRouterV2,
  IGLPRewardsRouterV2__factory,
  IGMXIsolationModeVaultFactory,
  IGMXIsolationModeVaultFactory__factory,
  IGmxRegistryV1,
  IGmxRegistryV1__factory,
  IGmxRewardRouterV2,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester,
  IGmxVester__factory,
  ISGMX,
  ISGMX__factory,
} from '@dolomite-exchange/modules-glp/src/types';
import {
  IGmxDataStore,
  IGmxDataStore__factory,
  IGmxDepositHandler,
  IGmxDepositHandler__factory,
  IGmxExchangeRouter,
  IGmxExchangeRouter__factory,
  IGmxMarketToken,
  IGmxMarketToken__factory,
  IGmxReader,
  IGmxReader__factory,
  IGmxRouter,
  IGmxRouter__factory,
  IGmxWithdrawalHandler,
  IGmxWithdrawalHandler__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import {
  IERC20,
  IERC20__factory,
  IERC20Mintable,
  IERC20Mintable__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  ARB_MAP,
  BN_GMX_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP,
  ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP,
  ES_GMX_MAP,
  FS_GLP_MAP,
  GLP_MANAGER_MAP,
  GLP_MAP,
  GLP_REWARD_ROUTER_MAP,
  GMX_ARB_USD_MARKET_TOKEN_MAP,
  GMX_BTC_USD_MARKET_TOKEN_MAP,
  GMX_DATASTORE_MAP,
  GMX_DEPOSIT_HANDLER_MAP,
  GMX_DEPOSIT_VAULT_MAP,
  GMX_ETH_USD_MARKET_TOKEN_MAP,
  GMX_EXCHANGE_ROUTER_MAP,
  GMX_EXECUTOR_MAP,
  GMX_LINK_USD_MARKET_TOKEN_MAP,
  GMX_MAP,
  GMX_READER_MAP,
  GMX_REWARD_ROUTER_V2_MAP,
  GMX_REWARD_ROUTER_V3_MAP,
  GMX_ROUTER_MAP,
  GMX_VAULT_MAP,
  GMX_WITHDRAWAL_HANDLER_MAP,
  GMX_WITHDRAWAL_VAULT_MAP,
  LINK_MAP,
  NATIVE_USDC_MAP,
  S_GLP_MAP,
  S_GMX_MAP,
  SBF_GMX_MAP,
  V_GLP_MAP,
  V_GMX_MAP,
  WBTC_MAP,
  WETH_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { impersonateOrFallback } from '../index';
import { getContract } from '../setup';

export interface GmxEcosystem {
  bnGmx: IERC20;
  esGmx: IERC20Mintable;
  esGmxDistributorForStakedGlp: IEsGmxDistributor;
  esGmxDistributorForStakedGmx: IEsGmxDistributor;
  fsGlp: IERC20;
  glp: IERC20;
  glpManager: IGLPManager;
  glpRewardsRouter: IGLPRewardsRouterV2;
  gmx: IERC20;
  gmxRewardsRouterV2: IGmxRewardRouterV2;
  gmxRewardsRouterV3: IGmxRewardRouterV2;
  gmxVault: IGmxVault;
  sGlp: IERC20;
  sGmx: ISGMX;
  sbfGmx: IERC20;
  vGlp: IGmxVester;
  vGmx: IGmxVester;
  live: {
    dGlp: IGLPIsolationModeVaultFactoryOld;
    dGmx: IGMXIsolationModeVaultFactory,
    glpIsolationModeUnwrapperTraderV1: GLPIsolationModeUnwrapperTraderV1;
    glpIsolationModeWrapperTraderV1: GLPIsolationModeWrapperTraderV1;
    gmxRegistry: IGmxRegistryV1;
    gmxRegistryProxy: RegistryProxy;
  };
}

interface GmToken {
  marketToken: IGmxMarketToken;
  longToken: IERC20;
  shortToken: IERC20;
  longMarketId: BigNumberish;
  shortMarketId: BigNumberish;
}

export interface GmxEcosystemV2 {
  gmxDataStore: IGmxDataStore;
  gmxDepositHandler: IGmxDepositHandler;
  gmxDepositVault: SignerWithAddress;
  gmTokens: {
    arbUsd: GmToken;
    btcUsd: GmToken;
    ethUsd: GmToken;
    linkUsd: GmToken;
  };
  gmxEthUsdMarketToken: IGmxMarketToken;
  gmxExchangeRouter: IGmxExchangeRouter;
  gmxExecutor: SignerWithAddress;
  gmxReader: IGmxReader;
  gmxRouter: IGmxRouter;
  gmxWithdrawalHandler: IGmxWithdrawalHandler;
  gmxWithdrawalVault: SignerWithAddress;
}

export async function createGmxEcosystem(network: Network, signer: SignerWithAddress): Promise<GmxEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const esGmxDistributorAddressForGlp = ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP[network]!;
  const esGmxDistributorAddressForGmx = ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP[network]!;

  const esGmxDistributorForGlp = getContract(esGmxDistributorAddressForGlp, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGlp = await impersonateOrFallback(
    await esGmxDistributorForGlp.connect(signer).admin(),
    true,
    signer,
  );
  const esGmxDistributorForGmx = getContract(esGmxDistributorAddressForGmx, IEsGmxDistributor__factory.connect, signer);
  const esGmxAdminForGmx = await impersonateOrFallback(
    await esGmxDistributorForGmx.connect(signer).admin(),
    true,
    signer,
  );
  return {
    bnGmx: getContract(BN_GMX_MAP[network] as string, IERC20__factory.connect, signer),
    esGmx: getContract(ES_GMX_MAP[network] as string, IERC20Mintable__factory.connect, signer),
    esGmxDistributorForStakedGlp: esGmxDistributorForGlp.connect(esGmxAdminForGlp),
    esGmxDistributorForStakedGmx: esGmxDistributorForGmx.connect(esGmxAdminForGmx),
    fsGlp: getContract(FS_GLP_MAP[network] as string, IERC20__factory.connect, signer),
    glp: getContract(GLP_MAP[network] as string, IERC20__factory.connect, signer),
    glpManager: getContract(
      GLP_MANAGER_MAP[network] as string,
      IGLPManager__factory.connect,
      signer,
    ),
    glpRewardsRouter: getContract(
      GLP_REWARD_ROUTER_MAP[network] as string,
      IGLPRewardsRouterV2__factory.connect,
      signer,
    ),
    gmx: getContract(GMX_MAP[network]!.address, IERC20__factory.connect, signer),
    gmxRewardsRouterV2: getContract(
      GMX_REWARD_ROUTER_V2_MAP[network] as string,
      IGmxRewardRouterV2__factory.connect,
      signer,
    ),
    gmxRewardsRouterV3: getContract(
      GMX_REWARD_ROUTER_V3_MAP[network] as string,
      IGmxRewardRouterV2__factory.connect,
      signer,
    ),
    gmxVault: getContract(GMX_VAULT_MAP[network] as string, IGmxVault__factory.connect, signer),
    sGlp: getContract(S_GLP_MAP[network] as string, IERC20__factory.connect, signer),
    sGmx: getContract(S_GMX_MAP[network] as string, ISGMX__factory.connect, signer),
    sbfGmx: getContract(SBF_GMX_MAP[network] as string, IERC20__factory.connect, signer),
    vGlp: getContract(V_GLP_MAP[network] as string, IGmxVester__factory.connect, signer),
    vGmx: getContract(V_GMX_MAP[network] as string, IGmxVester__factory.connect, signer),
    live: {
      dGlp: getContract(
        (Deployments.GLPIsolationModeVaultFactory as any)[network]?.address,
        IGLPIsolationModeVaultFactoryOld__factory.connect,
        signer,
      ),
      dGmx: getContract(
        (Deployments.GMXIsolationModeVaultFactory as any)[network]?.address,
        IGMXIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      glpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeUnwrapperTraderV1__factory.connect,
        signer,
      ),
      glpIsolationModeWrapperTraderV1: getContract(
        (Deployments.GLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        GLPIsolationModeWrapperTraderV1__factory.connect,
        signer,
      ),
      gmxRegistry: getContract(
        (Deployments.GmxRegistryProxy as any)[network]?.address,
        IGmxRegistryV1__factory.connect,
        signer,
      ),
      gmxRegistryProxy: getContract(
        (Deployments.GmxRegistryProxy as any)[network]?.address,
        RegistryProxy__factory.connect,
        signer,
      ),
    },
  };
}

export async function createGmxEcosystemV2(network: Network, signer: SignerWithAddress): Promise<GmxEcosystemV2> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    gmxDepositHandler: getContract(
      GMX_DEPOSIT_HANDLER_MAP[network] as string,
      IGmxDepositHandler__factory.connect,
      signer,
    ),
    gmxDepositVault: await impersonateOrFallback(GMX_DEPOSIT_VAULT_MAP[network] as string, true, signer),
    gmTokens: {
      ethUsd: {
        marketToken: getContract(
          GMX_ETH_USD_MARKET_TOKEN_MAP[network] as string,
          IGmxMarketToken__factory.connect,
          signer,
        ),
        longToken: IERC20__factory.connect(WETH_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WETH_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      btcUsd: {
        marketToken: getContract(
          GMX_BTC_USD_MARKET_TOKEN_MAP[network] as string,
          IGmxMarketToken__factory.connect,
          signer,
        ),
        longToken: IERC20__factory.connect(WBTC_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: WBTC_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      arbUsd: {
        marketToken: getContract(
          GMX_ARB_USD_MARKET_TOKEN_MAP[network] as string,
          IGmxMarketToken__factory.connect,
          signer,
        ),
        longToken: IERC20__factory.connect(ARB_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: ARB_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
      linkUsd: {
        marketToken: getContract(
          GMX_LINK_USD_MARKET_TOKEN_MAP[network] as string,
          IGmxMarketToken__factory.connect,
          signer,
        ),
        longToken: IERC20__factory.connect(LINK_MAP[network].address, signer),
        shortToken: IERC20__factory.connect(NATIVE_USDC_MAP[network].address, signer),
        longMarketId: LINK_MAP[network].marketId,
        shortMarketId: NATIVE_USDC_MAP[network].marketId,
      },
    },
    gmxEthUsdMarketToken: getContract(
      GMX_ETH_USD_MARKET_TOKEN_MAP[network] as string,
      IGmxMarketToken__factory.connect,
      signer,
    ),
    gmxDataStore: getContract(
      GMX_DATASTORE_MAP[network] as string,
      IGmxDataStore__factory.connect,
      signer,
    ),
    gmxExchangeRouter: getContract(
      GMX_EXCHANGE_ROUTER_MAP[network] as string,
      IGmxExchangeRouter__factory.connect,
      signer,
    ),
    gmxExecutor: await impersonateOrFallback(GMX_EXECUTOR_MAP[network] as string, true, signer),
    gmxReader: getContract(GMX_READER_MAP[network] as string, IGmxReader__factory.connect, signer),
    gmxRouter: getContract(GMX_ROUTER_MAP[network] as string, IGmxRouter__factory.connect, signer),
    gmxWithdrawalHandler: getContract(
      GMX_WITHDRAWAL_HANDLER_MAP[network] as string,
      IGmxWithdrawalHandler__factory.connect,
      signer,
    ),
    gmxWithdrawalVault: await impersonateOrFallback(GMX_WITHDRAWAL_VAULT_MAP[network] as string, true, signer),
  };
}

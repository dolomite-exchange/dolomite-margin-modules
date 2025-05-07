import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { IERC20, IERC20__factory, RegistryProxy, RegistryProxy__factory } from 'packages/base/src/types';
import {
  BERACHAIN_REWARDS_VAULT_FACTORY_MAP,
  BGTM_MAP,
  HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP,
  HONEY_USDC_BEX_LP_TOKEN_MAP,
  HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP,
  HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP,
  HONEY_WBERA_BEX_LP_TOKEN_MAP,
  HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP,
  IBGT_STAKING_POOL_MAP,
  INFRARED_MAP,
} from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import {
  BerachainRewardsRegistry,
  BerachainRewardsRegistry__factory,
  IBerachainRewardsFactory,
  IBerachainRewardsFactory__factory,
  IBGTM,
  IBGTM__factory,
  IInfrared,
  IInfrared__factory,
  IInfraredVault,
  IInfraredVault__factory,
  INativeRewardVault,
  INativeRewardVault__factory,
  InfraredBGTIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeTokenVaultV1__factory,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeUnwrapperTraderV2__factory,
  POLIsolationModeWrapperTraderV2,
  POLIsolationModeWrapperTraderV2__factory,
  POLLiquidatorProxyV1,
  POLLiquidatorProxyV1__factory,
} from 'packages/berachain/src/types';
import { getMaxDeploymentVersionAddressByDeploymentKey } from 'packages/deployment/src/utils/deploy-utils';

export interface BerachainRewardsEcosystem {
  berachainRewardsFactory: IBerachainRewardsFactory;
  infrared: IInfrared;
  bgtm: IBGTM;
  iBgtStakingPool: IInfraredVault;
  listedRewardAssets: {
    bexHoneyUsdc: ListedRewardAsset;
    bexHoneyWbera: ListedRewardAsset;
  };
  // live: {
  //   registry: BerachainRewardsRegistry;
  //   registryProxy: RegistryProxy;
  //   tokenVaultImplementation: POLIsolationModeTokenVaultV1;
  //   unwrapperImplementation: POLIsolationModeUnwrapperTraderV2;
  //   wrapperImplementation: POLIsolationModeWrapperTraderV2;
  //   polLiquidatorProxy: POLLiquidatorProxyV1;
  // }
}

export interface ListedRewardAsset {
  asset: IERC20;
  nativeRewardVault: INativeRewardVault;
  infraredRewardVault: IInfraredVault;
}

export async function createBerachainRewardsEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<BerachainRewardsEcosystem> {
  if (network !== Network.Berachain) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  // const tokenVaultImplementation = getMaxDeploymentVersionAddressByDeploymentKey(
  //   'POLIsolationModeTokenVaultImplementation',
  //   network
  // );
  // const unwrapperImplementation = getMaxDeploymentVersionAddressByDeploymentKey(
  //   'POLIsolationModeUnwrapperTraderImplementation',
  //   network
  // );
  // const wrapperImplementation = getMaxDeploymentVersionAddressByDeploymentKey(
  //   'POLIsolationModeWrapperTraderImplementation',
  //   network
  // );
  // const polLiquidatorProxy = getMaxDeploymentVersionAddressByDeploymentKey(
  //   'POLLiquidatorProxy',
  //   network
  // );

  return {
    berachainRewardsFactory: IBerachainRewardsFactory__factory.connect(
      BERACHAIN_REWARDS_VAULT_FACTORY_MAP[network]!,
      signer,
    ),
    bgtm: IBGTM__factory.connect(BGTM_MAP[network]!, signer),
    infrared: IInfrared__factory.connect(INFRARED_MAP[network]!, signer),
    iBgtStakingPool: IInfraredVault__factory.connect(IBGT_STAKING_POOL_MAP[network]!, signer),
    listedRewardAssets: {
      bexHoneyUsdc: {
        asset: IERC20__factory.connect(HONEY_USDC_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(
          HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP[network]!,
          signer,
        ),
        infraredRewardVault: IInfraredVault__factory.connect(
          HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP[network]!,
          signer,
        ),
      },
      bexHoneyWbera: {
        asset: IERC20__factory.connect(HONEY_WBERA_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(
          HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP[network]!,
          signer,
        ),
        infraredRewardVault: IInfraredVault__factory.connect(
          HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP[network]!,
          signer,
        ),
      },
    },
    // live: {
    //   registry: BerachainRewardsRegistry__factory.connect(Deployments.BerachainRewardsRegistryProxy['80094'].address, signer),
    //   registryProxy: RegistryProxy__factory.connect(Deployments.BerachainRewardsRegistryProxy['80094'].address, signer),
    //   tokenVaultImplementation: POLIsolationModeTokenVaultV1__factory.connect(tokenVaultImplementation, signer),
    //   unwrapperImplementation: POLIsolationModeUnwrapperTraderV2__factory.connect(unwrapperImplementation, signer),
    //   wrapperImplementation: POLIsolationModeWrapperTraderV2__factory.connect(wrapperImplementation, signer),
    //   polLiquidatorProxy: POLLiquidatorProxyV1__factory.connect(polLiquidatorProxy, signer),
    // }
  };
}

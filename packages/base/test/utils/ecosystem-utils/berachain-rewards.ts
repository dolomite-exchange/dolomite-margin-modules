import { IERC20, IERC20__factory } from "packages/base/src/types";
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
  INFRARED_MAP
} from "packages/base/src/utils/constants";
import { Network } from "packages/base/src/utils/no-deps-constants";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import {
  INativeRewardVault,
  INativeRewardVault__factory,
  IInfraredVault,
  IInfraredVault__factory,
  IInfrared,
  IInfrared__factory,
  IBGTM,
  IBGTM__factory,
  IBerachainRewardsFactory,
  IBerachainRewardsFactory__factory,
} from "packages/berachain/src/types";

export interface BerachainRewardsEcosystem {
  berachainRewardsFactory: IBerachainRewardsFactory;
  infrared: IInfrared;
  bgtm: IBGTM;
  iBgtStakingPool: IInfraredVault;
  listedRewardAssets: {
    bexHoneyUsdc: ListedRewardAsset;
    bexHoneyWbera: ListedRewardAsset;
  }
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

  return {
    berachainRewardsFactory: IBerachainRewardsFactory__factory.connect(BERACHAIN_REWARDS_VAULT_FACTORY_MAP[network]!, signer),
    bgtm: IBGTM__factory.connect(BGTM_MAP[network]!, signer),
    infrared: IInfrared__factory.connect(INFRARED_MAP[network]!, signer),
    iBgtStakingPool: IInfraredVault__factory.connect(IBGT_STAKING_POOL_MAP[network]!, signer),
    listedRewardAssets: {
      bexHoneyUsdc: {
        asset: IERC20__factory.connect(HONEY_USDC_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredVault__factory.connect(HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
      bexHoneyWbera: {
        asset: IERC20__factory.connect(HONEY_WBERA_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredVault__factory.connect(HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
    }
  };
}
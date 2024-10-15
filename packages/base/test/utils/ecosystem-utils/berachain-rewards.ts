import { IERC20, IERC20__factory } from "packages/base/src/types";
import {
  HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP,
  HONEY_USDC_BEX_LP_TOKEN_MAP,
  HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP,
  HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP,
  HONEY_WBERA_BEX_LP_TOKEN_MAP,
  HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP,
  IBGT_STAKING_POOL_MAP
} from "packages/base/src/utils/constants";
import { Network } from "packages/base/src/utils/no-deps-constants";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { INativeRewardVault, INativeRewardVault__factory, IInfraredRewardVault, IInfraredRewardVault__factory, IInfraredBGTStakingPool, IInfraredBGTStakingPool__factory } from "packages/berachain/src/types";

export interface BerachainRewardsEcosystem {
  iBgtStakingPool: IInfraredBGTStakingPool;
  listedRewardAssets: {
    bexHoneyUsdc: ListedRewardAsset;
    bexHoneyWbera: ListedRewardAsset;
  }
}

export interface ListedRewardAsset {
  asset: IERC20;
  nativeRewardVault: INativeRewardVault;
  infraredRewardVault: IInfraredRewardVault;
}

export async function createBerachainRewardsEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<BerachainRewardsEcosystem> {
  if (network !== Network.Berachain) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    iBgtStakingPool: IInfraredBGTStakingPool__factory.connect(IBGT_STAKING_POOL_MAP[network]!, signer),
    listedRewardAssets: {
      bexHoneyUsdc: {
        asset: IERC20__factory.connect(HONEY_USDC_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredRewardVault__factory.connect(HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
      bexHoneyWbera: {
        asset: IERC20__factory.connect(HONEY_WBERA_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: INativeRewardVault__factory.connect(HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredRewardVault__factory.connect(HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
    }
  };
}
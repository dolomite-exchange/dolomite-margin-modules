import { IERC20, IERC20__factory } from "packages/base/src/types";
import { HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP, HONEY_USDC_BEX_LP_TOKEN_MAP, HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP, HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP, HONEY_WBERA_BEX_LP_TOKEN_MAP, HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP } from "packages/base/src/utils/constants";
import { Network } from "packages/base/src/utils/no-deps-constants";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { IBeraRewardVault, IBeraRewardVault__factory, IInfraredVault, IInfraredVault__factory } from "packages/berachain/src/types";

export interface BerachainRewardsEcosystem {
  listedRewardAssets: {
    bexHoneyUsdc: ListedRewardAsset;
    bexHoneyWbera: ListedRewardAsset;
  }
}

export interface ListedRewardAsset {
  asset: IERC20;
  nativeRewardVault: IBeraRewardVault;
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
    listedRewardAssets: {
      bexHoneyUsdc: {
        asset: IERC20__factory.connect(HONEY_USDC_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: IBeraRewardVault__factory.connect(HONEY_USDC_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredVault__factory.connect(HONEY_USDC_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
      bexHoneyWbera: {
        asset: IERC20__factory.connect(HONEY_WBERA_BEX_LP_TOKEN_MAP[network]!, signer),
        nativeRewardVault: IBeraRewardVault__factory.connect(HONEY_WBERA_BEX_NATIVE_REWARD_VAULT_MAP[network]!, signer),
        infraredRewardVault: IInfraredVault__factory.connect(HONEY_WBERA_BEX_INFRARED_REWARD_VAULT_MAP[network]!, signer),
      },
    }
  };
}
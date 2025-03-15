import { Network } from "packages/base/src/utils/no-deps-constants";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { DOLO, OptionAirdrop, RegularAirdrop, StrategicVestingClaims, VestingClaims } from "packages/tokenomics/src/types";

export interface TokenomicsEcosystem {
  dolo: DOLO;

  optionAirdrop: OptionAirdrop;
  regularAirdrop: RegularAirdrop;
  vestingClaims: VestingClaims;
  strategicVesting: StrategicVestingClaims;
}

export async function createTokenomicsEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety
): Promise<TokenomicsEcosystem> {
  // @todo implement
  return {} as any;
}
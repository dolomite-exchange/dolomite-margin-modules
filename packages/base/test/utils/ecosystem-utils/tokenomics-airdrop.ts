import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { OptionAirdrop, RegularAirdrop, StrategicVestingClaims, VestingClaims } from 'packages/tokenomics/src/types';

export interface TokenomicsAirdropEcosystem {
  optionAirdrop: OptionAirdrop;
  regularAirdrop: RegularAirdrop;
  vestingClaims: VestingClaims;
  strategicVesting: StrategicVestingClaims;
}

export async function createTokenomicsAirdropEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<TokenomicsAirdropEcosystem> {
  // @todo implement
  return {} as any;
}

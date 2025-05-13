import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
import {
  OptionAirdrop,
  OptionAirdrop__factory,
  RegularAirdrop,
  RegularAirdrop__factory,
  StrategicVestingClaims,
  StrategicVestingClaims__factory,
  VestingClaims,
  VestingClaims__factory,
} from 'packages/tokenomics/src/types';

export interface TokenomicsAirdropEcosystem {
  optionAirdrop: OptionAirdrop;
  regularAirdrop: RegularAirdrop;
  regularInvestorVesting: VestingClaims;
  strategicVesting: StrategicVestingClaims;
  advisorVesting: VestingClaims;
}

export async function createTokenomicsAirdropEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<TokenomicsAirdropEcosystem> {
  if (network !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network, found: ${network}`));
  }

  return {
    optionAirdrop: OptionAirdrop__factory.connect(Deployments.OptionAirdropProxy[network].address, signer),
    regularAirdrop: RegularAirdrop__factory.connect(Deployments.RegularAirdropProxy[network].address, signer),
    regularInvestorVesting: VestingClaims__factory.connect(Deployments.VestingClaimsProxy[network].address, signer),
    strategicVesting: StrategicVestingClaims__factory.connect(
      Deployments.StrategicVestingProxy[network].address,
      signer,
    ),
    advisorVesting: VestingClaims__factory.connect(Deployments.AdvisorClaimsProxy[network].address, signer),
  };
}

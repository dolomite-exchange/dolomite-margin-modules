import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { IBuybackPool, UpgradeableProxy } from 'packages/liquidity-mining/src/types';
import {
  DOLO,
  IVeExternalVesterV1,
  IVesterDiscountCalculator,
  ODOLO,
  VeFeeCalculator,
  VotingEscrow,
} from 'packages/tokenomics/src/types';

export interface TokenomicsEcosystem {
  buybackPool: IBuybackPool;
  dolo: DOLO;
  oDolo: ODOLO;
  veDolo: VotingEscrow;
  veDoloProxy: UpgradeableProxy;
  veExternalVester: IVeExternalVesterV1;
  veExternalVesterProxy: UpgradeableProxy;
  veVesterDiscountCalculator: IVesterDiscountCalculator;
  veFeeCalculator: VeFeeCalculator;
}

export async function createTokenomicsEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<TokenomicsEcosystem> {
  // @todo implement
  return {} as any;
}

import { Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import Deployments from 'packages/deployment/src/deploy/deployments.json';
import {
  IBuybackPool,
  IBuybackPool__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
} from 'packages/liquidity-mining/src/types';
import {
  DOLO,
  DOLO__factory,
  IVeExternalVesterV1,
  IVeExternalVesterV1__factory,
  IVesterDiscountCalculator,
  IVesterDiscountCalculator__factory,
  ODOLO,
  ODOLO__factory,
  RollingClaims,
  RollingClaims__factory,
  VeFeeCalculator,
  VeFeeCalculator__factory,
  VotingEscrow,
  VotingEscrow__factory,
} from 'packages/tokenomics/src/types';
import { RegistryProxy, RegistryProxy__factory } from '../../../src/types';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

export interface TokenomicsEcosystem {
  buybackPool: IBuybackPool;
  dolo: DOLO;
  handlerAddress: string;
  oDolo: ODOLO;
  rollingClaims: RollingClaims;
  rollingClaimsProxy: RegistryProxy;
  veDolo: VotingEscrow;
  veDoloProxy: UpgradeableProxy;
  veExternalVester: IVeExternalVesterV1;
  veExternalVesterProxy: UpgradeableProxy;
  veVesterDiscountCalculator: IVesterDiscountCalculator;
  veFeeCalculator: VeFeeCalculator;
}

export const LEVEL_INITIATOR_ADDRESS = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe';

export async function createTokenomicsEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<TokenomicsEcosystem> {
  if (network !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  return {
    buybackPool: IBuybackPool__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('DOLOBuybackPool', network),
      signer,
    ),
    dolo: DOLO__factory.connect(Deployments.DolomiteToken[network].address, signer),
    handlerAddress: LEVEL_INITIATOR_ADDRESS,
    oDolo: ODOLO__factory.connect(Deployments.oDOLO[network].address, signer),
    rollingClaims: RollingClaims__factory.connect(Deployments.ODoloRollingClaimsProxy[network].address, signer),
    rollingClaimsProxy: RegistryProxy__factory.connect(Deployments.ODoloRollingClaimsProxy[network].address, signer),
    veDolo: VotingEscrow__factory.connect(Deployments.VotingEscrowProxy[network].address, signer),
    veDoloProxy: UpgradeableProxy__factory.connect(Deployments.VotingEscrowProxy[network].address, signer),
    veExternalVester: IVeExternalVesterV1__factory.connect(Deployments.VeExternalVesterProxy[network].address, signer),
    veExternalVesterProxy: UpgradeableProxy__factory.connect(
      Deployments.VeExternalVesterProxy[network].address,
      signer,
    ),
    veVesterDiscountCalculator: IVesterDiscountCalculator__factory.connect(
      Deployments.ExternalVesterDiscountCalculatorV1[network].address,
      signer,
    ),
    veFeeCalculator: VeFeeCalculator__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('VeFeeCalculator', network),
      signer,
    ),
  };
}

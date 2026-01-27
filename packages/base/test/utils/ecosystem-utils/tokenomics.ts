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
  VeFeeCalculator__factory, VestingClaims, VestingClaims__factory,
  VotingEscrow,
  VotingEscrow__factory,
} from 'packages/tokenomics/src/types';
import { RegistryProxy, RegistryProxy__factory } from '../../../src/types';
import {
  DOLOMITE_DAO_GNOSIS_SAFE_MAP,
  LEVEL_INITIATOR_ADDRESS_MAP,
} from '../../../src/utils/constants';
import { getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

export interface TokenomicsEcosystem {
  advisorClaims: VestingClaims;
  advisorClaimsProxy: RegistryProxy;
  buybackPool: IBuybackPool;
  daoAddress: string;
  dolo: DOLO;
  handlerAddress: string;
  oDolo: ODOLO;
  regularInvestorClaims: VestingClaims;
  regularInvestorClaimsProxy: RegistryProxy;
  rollingClaims: RollingClaims;
  rollingClaimsProxy: RegistryProxy;
  strategicInvestorClaims: VestingClaims;
  strategicInvestorClaimsProxy: RegistryProxy;
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
  if (network !== Network.Berachain) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  return {
    advisorClaims: VestingClaims__factory.connect(Deployments.AdvisorClaimsProxy[network].address, signer),
    advisorClaimsProxy: RegistryProxy__factory.connect(Deployments.AdvisorClaimsProxy[network].address, signer),
    buybackPool: IBuybackPool__factory.connect(
      getMaxDeploymentVersionAddressByDeploymentKey('DOLOBuybackPool', network),
      signer,
    ),
    daoAddress: DOLOMITE_DAO_GNOSIS_SAFE_MAP[network]!,
    dolo: DOLO__factory.connect(Deployments.DolomiteToken[network].address, signer),
    handlerAddress: LEVEL_INITIATOR_ADDRESS_MAP[network],
    oDolo: ODOLO__factory.connect(Deployments.oDOLO[network].address, signer),
    regularInvestorClaims: VestingClaims__factory.connect(Deployments.VestingClaimsProxy[network].address, signer),
    regularInvestorClaimsProxy: RegistryProxy__factory.connect(Deployments.VestingClaimsProxy[network].address, signer),
    rollingClaims: RollingClaims__factory.connect(Deployments.ODoloRollingClaimsProxy[network].address, signer),
    rollingClaimsProxy: RegistryProxy__factory.connect(Deployments.ODoloRollingClaimsProxy[network].address, signer),
    strategicInvestorClaims: VestingClaims__factory.connect(Deployments.StrategicVestingProxy[network].address, signer),
    strategicInvestorClaimsProxy: RegistryProxy__factory.connect(
      Deployments.StrategicVestingProxy[network].address,
      signer,
    ),
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

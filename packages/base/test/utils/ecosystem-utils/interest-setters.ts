import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IDolomiteInterestSetter, IDolomiteInterestSetter__factory, } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import deployments from  '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import coreDeployments from  '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';

export interface InterestSetters {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  linearStepFunction6L94UInterestSetter: IDolomiteInterestSetter;
  linearStepFunction8L92UInterestSetter: IDolomiteInterestSetter;
  linearStepFunction10L90U95OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction14L86UInterestSetter: IDolomiteInterestSetter;
}

export async function createInterestSetters(
  network: Network,
  signer: SignerWithAddress,
): Promise<InterestSetters> {
  return {
    alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
      coreDeployments.AlwaysZeroInterestSetter[network].address,
      signer,
    ),
    linearStepFunction6L94UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Stablecoin6L94ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Stablecoin8L92ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
    linearStepFunction10L90U95OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Stablecoin10L90U95OLinearStepFunctionInterestSetter[network].address,
      signer,
    ),
    linearStepFunction14L86UInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.Altcoin14L86ULinearStepFunctionInterestSetter[network].address,
      signer,
    ),
  };
}
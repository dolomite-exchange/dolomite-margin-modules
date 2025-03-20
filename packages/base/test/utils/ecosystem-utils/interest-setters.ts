import coreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  ILinearStepFunctionInterestSetter,
  ILinearStepFunctionInterestSetter__factory,
} from 'packages/interest-setters/src/types';
import { IDolomiteInterestSetter, IDolomiteInterestSetter__factory } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface InterestSetters {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  linearStepFunction6L94U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction6L94U80OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction6L94U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction7L93U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction8L92U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction8L92U80OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction8L92U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction10L90U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction10L90U95OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction12L88U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction14L86U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U60OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U75OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U80OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U85OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction15L135U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction16L84U60OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction16L84U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction16L84U80OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction16L84U90OInterestSetter: ILinearStepFunctionInterestSetter;
}

export async function createInterestSetters(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<InterestSetters> {
  return {
    alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
      coreDeployments.AlwaysZeroInterestSetter[network].address,
      signer,
    ),
    linearStepFunction6L94U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction6L94U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction6L94U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction6L94U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction6L94U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction6L94U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction7L93U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction7L93U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction8L92U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction8L92U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction8L92U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction10L90U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction10L90U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction10L90U95OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction10L90U95OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction12L88U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction12L88U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction14L86U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction14L86U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U60OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U60OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U75OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U75OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U85OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U85OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U60OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U60OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U90OInterestSetter[network].address,
      signer,
    ),
  };
}

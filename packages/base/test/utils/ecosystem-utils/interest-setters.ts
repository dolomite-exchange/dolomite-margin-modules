import coreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { IDolomiteInterestSetter, IDolomiteInterestSetter__factory } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export interface InterestSetters {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  linearStepFunction6L94U90InterestSetter: IDolomiteInterestSetter;
  linearStepFunction8L92U90OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction10L90U90OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction10L90U95OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction12L88U90OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction14L86U90OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction15L135U70OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction15L135U75OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction15L135U80OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction15L135U85OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction15L135U90OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction16L84U70OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction16L84U80OInterestSetter: IDolomiteInterestSetter;
  linearStepFunction16L84U90OInterestSetter: IDolomiteInterestSetter;
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
    linearStepFunction6L94U90InterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction6L94U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction8L92U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction8L92U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction10L90U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction10L90U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction10L90U95OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction10L90U95OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction12L88U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction12L88U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction14L86U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction14L86U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U70OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U75OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U75OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U80OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U85OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U85OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction15L135U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction15L135U90OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U70OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U70OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U80OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U80OInterestSetter[network].address,
      signer,
    ),
    linearStepFunction16L84U90OInterestSetter: IDolomiteInterestSetter__factory.connect(
      deployments.LinearStepFunction16L84U90OInterestSetter[network].address,
      signer,
    ),
  };
}

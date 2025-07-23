import coreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  ILinearStepFunctionInterestSetter,
  ModularLinearStepFunctionInterestSetter,
  ModularLinearStepFunctionInterestSetter__factory,
} from 'packages/interest-setters/src/types';
import { IDolomiteInterestSetter, IDolomiteInterestSetter__factory } from '../../../src/types';
import { DolomiteNetwork, Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';

export type InterestSetters<T extends Network> = T extends Network.Ethereum
  ? InterestSettersModular
  : T extends Network.Botanix
  ? InterestSettersModular
  : InterestSettersModular;

export interface InterestSettersModular {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  modularInterestSetter: ModularLinearStepFunctionInterestSetter;
}

export interface InterestSettersForOtherChains {
  alwaysZeroInterestSetter: IDolomiteInterestSetter;
  linearStepFunction4L96U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction4L96U80OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction4L96U90OInterestSetter: ILinearStepFunctionInterestSetter;
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
  linearStepFunction12L88U95OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction14L86U90OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction14L86U95OInterestSetter: ILinearStepFunctionInterestSetter;
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
  linearStepFunction16L84U95OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction20L105U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction20L130U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction30L95U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction30L120U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction40L85U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction40L110U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction50L75U70OInterestSetter: ILinearStepFunctionInterestSetter;
  linearStepFunction50L100U70OInterestSetter: ILinearStepFunctionInterestSetter;
}

export async function createInterestSetters<T extends DolomiteNetwork>(
  network: T,
  signer: SignerWithAddressWithSafety,
): Promise<InterestSetters<T>> {
  if (network === Network.Ethereum || network === Network.Botanix) {
    const typedNetwork = network as Extract<Network, Network.Ethereum | Network.Botanix>;
    return {
      alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
        coreDeployments.AlwaysZeroInterestSetter[network].address,
        signer,
      ),
      modularInterestSetter: ModularLinearStepFunctionInterestSetter__factory.connect(
        deployments.ModularLinearStepFunctionInterestSetter[typedNetwork].address,
        signer,
      ),
    } as InterestSetters<T>;
  }

  const typedNetwork = network as Exclude<Network, Network.Ethereum | Network.Botanix>;
  return {
    alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
      coreDeployments.AlwaysZeroInterestSetter[network].address,
      signer,
    ),
    modularInterestSetter: ModularLinearStepFunctionInterestSetter__factory.connect(
      deployments.ModularLinearStepFunctionInterestSetter[typedNetwork].address,
      signer,
    ),
  } as InterestSetters<T>;
  // return {
  //   alwaysZeroInterestSetter: IDolomiteInterestSetter__factory.connect(
  //     coreDeployments.AlwaysZeroInterestSetter[network].address,
  //     signer,
  //   ),
  //   modularInterestSetter: ModularLinearStepFunctionInterestSetter__factory.connect(
  //     deployments.ModularLinearStepFunctionInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction4L96U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction4L96U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction4L96U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction4L96U80OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction4L96U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction4L96U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction6L94U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction6L94U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction6L94U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction6L94U80OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction6L94U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction6L94U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction7L93U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction7L93U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction8L92U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction8L92U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction8L92U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction8L92U80OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction8L92U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction8L92U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction10L90U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction10L90U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction10L90U95OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction10L90U95OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction12L88U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction12L88U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction12L88U95OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction12L88U95OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction14L86U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction14L86U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction14L86U95OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction14L86U95OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U60OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U60OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U75OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U75OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U80OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U85OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U85OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction15L135U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction15L135U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction16L84U60OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction16L84U60OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction16L84U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction16L84U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction16L84U80OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction16L84U80OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction16L84U90OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction16L84U90OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction16L84U95OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction16L84U95OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //
  //   linearStepFunction20L105U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction20L105U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction20L130U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction20L130U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction30L95U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction30L95U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction30L120U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction30L120U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction40L85U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction40L85U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction40L110U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction40L110U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction50L75U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction50L75U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  //   linearStepFunction50L100U70OInterestSetter: ILinearStepFunctionInterestSetter__factory.connect(
  //     deployments.LinearStepFunction50L100U70OInterestSetter[typedNetwork].address,
  //     signer,
  //   ),
  // } as InterestSetters<T>;
}

import { CoreProtocol } from '../../../test/utils/setup';
import { OARB, VesterImplementation, VesterProxy } from '../../types';

export function getVesterImplementationConstructorParams(core: CoreProtocol): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    core.tokens.weth.address,
    core.tokens.arb.address,
  ];
}

export async function getVesterProxyConstructorParams(
  core: CoreProtocol,
  vesterImplementation: VesterImplementation,
  oARB: OARB,
): Promise<any[]> {
  const calldata = await vesterImplementation.populateTransaction.initialize(
    oARB.address,
  );

  return [vesterImplementation.address, core.dolomiteMargin.address, calldata.data!];
}

export function getOARBConstructorParams(core: CoreProtocol): any[] {
  return [core.dolomiteMargin.address];
}

export function getVesterExploderConstructorParams(
  core: CoreProtocol,
  vester: VesterImplementation | VesterProxy,
): any[] {
  return [
    vester.address,
    core.dolomiteMargin.address,
    ['0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2'],
  ];
}

export function getRewardsDistributorConstructorParams(
  core: CoreProtocol,
  oARB: OARB,
): any[] {
  return [core.dolomiteMargin.address, oARB.address];
}

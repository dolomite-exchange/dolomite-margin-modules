import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ethers } from 'ethers';
import { OARB, VesterImplementationV1, VesterImplementationV2, VesterProxy } from './types';

export function getVesterImplementationConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    core.tokens.weth.address,
    core.tokens.arb!.address,
  ];
}

export async function getVesterV1ProxyConstructorParams(
  core: CoreProtocolArbitrumOne,
  vesterImplementation: VesterImplementationV1,
  oARB: OARB,
  baseUri: string,
): Promise<any[]> {
  const bytes = ethers.utils.defaultAbiCoder.encode(['address', 'string'], [oARB.address, baseUri]);
  const calldata = await vesterImplementation.populateTransaction.initialize(bytes);

  return [vesterImplementation.address, core.dolomiteMargin.address, calldata.data!];
}

export function getOARBConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  return [core.dolomiteMargin.address];
}

export function getVesterExploderConstructorParams(
  core: CoreProtocolArbitrumOne,
  vester: VesterImplementationV1 | VesterImplementationV2 | VesterProxy,
): any[] {
  return [
    vester.address,
    core.dolomiteMargin.address,
    ['0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2'],
  ];
}

export function getRewardsDistributorConstructorParams(
  core: CoreProtocolArbitrumOne,
  oARB: OARB,
  initialHandlers: string[],
): any[] {
  return [core.dolomiteMargin.address, oARB.address, initialHandlers];
}

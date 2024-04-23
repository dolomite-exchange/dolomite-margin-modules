import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ethers } from 'ethers';
import { IERC20, OARB, UpgradeableProxy, VesterImplementationV1, VesterImplementationV2 } from './types';

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
  vester: VesterImplementationV1 | VesterImplementationV2 | UpgradeableProxy,
): any[] {
  return [
    vester.address,
    core.dolomiteMargin.address,
    ['0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2'],
  ];
}

export function getRewardsDistributorConstructorParams(
  core: CoreProtocolArbitrumOne,
  oToken: IERC20,
  initialHandlers: string[],
): any[] {
  return [core.dolomiteMargin.address, oToken.address, initialHandlers, core.dolomiteRegistry.address];
}

export function getExternalOARBConstructorParams(owner: string, name: string, symbol: string): any[] {
  return [owner, name, symbol];
}

import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish, ethers } from 'ethers';
import { SignerWithAddressWithSafety } from '../../base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IERC20,
  IVesterDiscountCalculator, IVeToken,
  OARB,
  UpgradeableProxy,
  VesterImplementationV1,
  VesterImplementationV2,
  VotingEscrow,
} from './types';

export function getVesterImplementationConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  rewardToken: IERC20,
): any[] {
  return [core.dolomiteMargin.address, core.dolomiteRegistry.address, core.tokens.weth.address, rewardToken.address];
}

export function getExternalVesterDiscountCalculatorConstructorParams(
  veToken: VotingEscrow | IVeToken
): any[] {
  return [veToken.address];
}

export function getExternalVesterImplementationConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  paymentToken: IERC20,
  rewardToken: IERC20,
): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    pairToken.address,
    paymentToken.address,
    rewardToken.address,
  ];
}

export function getVeExternalVesterImplementationConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  pairMarketId: BigNumberish,
  paymentToken: IERC20,
  paymentMarketId: BigNumberish,
  rewardToken: IERC20,
  rewardMarketId: BigNumberish,
): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    pairToken.address,
    pairMarketId,
    paymentToken.address,
    paymentMarketId,
    rewardToken.address,
    rewardMarketId,
  ];
}

export function getExternalVesterInitializationCalldata(
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  owner: string | SignerWithAddressWithSafety,
  baseUri: string,
  name: string,
  symbol: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'address', 'string', 'string', 'string'],
    [
      discountCalculator.address,
      oToken.address,
      owner instanceof SignerWithAddressWithSafety ? owner.address : owner,
      baseUri,
      name,
      symbol,
    ],
  );
}

export function getVeExternalVesterInitializationCalldata(
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  baseUri: string,
  name: string,
  symbol: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'string', 'string', 'string'],
    [
      discountCalculator.address,
      oToken.address,
      baseUri,
      name,
      symbol,
    ],
  );
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
  return [vester.address, core.dolomiteMargin.address, ['0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2']];
}

export function getRewardsDistributorConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  oToken: IERC20,
  initialHandlers: string[],
): any[] {
  return [core.dolomiteMargin.address, oToken.address, initialHandlers, core.dolomiteRegistry.address];
}

export function getExternalOARBConstructorParams(owner: string, name: string, symbol: string): any[] {
  return [owner, name, symbol];
}

export function getVeFeeCalculatorConstructorParams(core: CoreProtocolArbitrumOne): any[] {
  return [core.dolomiteMargin.address];
}

export function getBuybackPoolConstructorParams(
  core: CoreProtocolArbitrumOne,
  rewardToken: IERC20,
  paymentToken: IERC20,
): any[] {
  return [rewardToken.address, paymentToken.address, core.dolomiteMargin.address];
}

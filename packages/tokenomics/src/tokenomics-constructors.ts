import { NetworkType } from "packages/base/src/utils/no-deps-constants";
import { CoreProtocolType } from "packages/base/test/utils/setup";
import { IERC20, IVesterDiscountCalculator, IVotingEscrow, MockVotingEscrow, VotingEscrow } from "./types";
import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

export function getDOLOConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>
): any[] {
  return [core.dolomiteMargin.address];
}

export function getODOLOConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>
): any[] {
  return [core.governance.address, 'oDOLO Token', 'oDOLO'];
}

export function getVeFeeCalculatorConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>
): any[] {
  return [core.dolomiteMargin.address];
}

export function getExternalVesterDiscountCalculatorConstructorParams(
  veToken: VotingEscrow | IVotingEscrow
): any[] {
  return [veToken.address];
}

export function getOptionAirdropConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
): any[] {
  return [dolo.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getRegularAirdropConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  veToken: VotingEscrow | MockVotingEscrow,
): any[] {
  return [dolo.address, veToken.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
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

import { BigNumberish } from 'ethers';

export function getLinearStepFunctionInterestSetterConstructorParams(
  lowerOptimalPercent: BigNumberish,
  upperOptimalPercent: BigNumberish,
  optimalUtilization: BigNumberish,
): any[] {
  return [lowerOptimalPercent, upperOptimalPercent, optimalUtilization];
}

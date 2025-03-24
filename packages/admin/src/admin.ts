import { BigNumberish } from "ethers";

export function getDolomiteOwnerConstructorParams(
  gnosisSafeAddress: string,
  secondsTimeLocked: BigNumberish
): any[] {
  return [gnosisSafeAddress, secondsTimeLocked];
}

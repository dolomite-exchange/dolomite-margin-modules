import { BigNumber } from "ethers";
import { ONE_WEEK_SECONDS } from "packages/base/src/utils/no-deps-constants";

export function convertToNearestWeek(
  timestamp: BigNumber,
  duration: BigNumber
): BigNumber {
  const increasedTimestamp = timestamp.add(duration);
  const divisor = increasedTimestamp.div(ONE_WEEK_SECONDS);
  return BigNumber.from(ONE_WEEK_SECONDS).mul(divisor);
}

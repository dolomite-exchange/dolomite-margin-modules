import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { ONE_WEEK_SECONDS } from 'packages/base/src/utils/no-deps-constants';

export interface VestingPositionStruct {
  creator: string;
  id: BigNumberish;
  startTime: BigNumberish;
  duration: BigNumberish;
  amount: BigNumberish;
}

export interface ExternalVestingPositionStruct {
  creator: string;
  id: BigNumberish;
  startTime: BigNumberish;
  duration: BigNumberish;
  oTokenAmount: BigNumberish;
  pairAmount: BigNumberish;
}

export interface ExternalVestingPositionStructV2 {
  creator: string;
  id: BigNumberish;
  startTime: BigNumberish;
  duration: BigNumberish;
  amount: BigNumberish;
}

export function expectEmptyPosition(position: VestingPositionStruct) {
  expect(position.creator).to.eq(ZERO_ADDRESS);
  expect(position.id).to.eq(0);
  expect(position.startTime).to.eq(0);
  expect(position.duration).to.eq(0);
  expect(position.amount).to.eq(0);
}

export function expectEmptyExternalVesterPosition(position: ExternalVestingPositionStruct) {
  expect(position.creator).to.eq(ZERO_ADDRESS);
  expect(position.id).to.eq(0);
  expect(position.startTime).to.eq(0);
  expect(position.duration).to.eq(0);
  expect(position.oTokenAmount).to.eq(0);
  expect(position.pairAmount).to.eq(0);
}

export function expectEmptyExternalVesterPositionV2(position: ExternalVestingPositionStructV2) {
  expect(position.creator).to.eq(ZERO_ADDRESS);
  expect(position.id).to.eq(0);
  expect(position.startTime).to.eq(0);
  expect(position.duration).to.eq(0);
  expect(position.amount).to.eq(0);
}

export function convertToNearestWeek(
  timestamp: BigNumber,
  duration: BigNumber
): BigNumber {
  const increasedTimestamp = timestamp.add(duration);
  const divisor = increasedTimestamp.div(ONE_WEEK_SECONDS);
  return BigNumber.from(ONE_WEEK_SECONDS).mul(divisor);
}

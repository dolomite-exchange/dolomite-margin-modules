import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';

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

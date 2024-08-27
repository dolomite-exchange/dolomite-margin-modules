import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { BigNumber, BigNumberish, BytesLike } from 'ethers';
import { ethers } from 'hardhat';
import Web3 from 'web3';

export interface AccountInfoStruct {
  owner: string;
  number: BigNumberish;
}

export interface AssetAmountStruct {
  sign: boolean;
  denomination: AmountDenomination;
  ref: AmountReference;
  value: BigNumberish;
}

export interface ActionArgsStruct {
  actionType: BigNumberish;
  accountId: BigNumberish;
  amount: AssetAmountStruct;
  primaryMarketId: BigNumberish;
  secondaryMarketId: BigNumberish;
  otherAddress: string;
  otherAccountId: BigNumberish;
  data: BytesLike;
}

export interface GenericTraderParamStruct {
  traderType: BigNumberish;
  makerAccountIndex: BigNumberish;
  trader: string;
  tradeData: BytesLike;
}

export interface ParStruct {
  sign: boolean;
  value: BigNumberish;
}

export interface WeiStruct {
  sign: boolean;
  value: BigNumberish;
}

export function calculateApr(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const base = ethers.BigNumber.from('1000000000000000000');
  const newValueBN = ethers.BigNumber.from(newValue);
  const oldValueBN = ethers.BigNumber.from(oldValue);
  return newValueBN.mul(base).div(oldValueBN).sub(base).mul(365 * 86400)
    .div(durationDeltaSeconds);
}

export function calculateApy(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const newValueBN = ethers.BigNumber.from(newValue);
  const oldValueBN = ethers.BigNumber.from(oldValue);
  const one = ethers.BigNumber.from('1000000000000000000');
  return one.add(calculateApr(newValueBN, oldValueBN, durationDeltaSeconds).div(365))
    .pow(365)
    .mul(one)
    .div(one.pow(365))
    .sub(one);
}

export function formatNumber(n: BigNumberish): string {
  const numberBN = ethers.BigNumber.from(n);
  return Web3.utils.fromWei(numberBN.toString());
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isArraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

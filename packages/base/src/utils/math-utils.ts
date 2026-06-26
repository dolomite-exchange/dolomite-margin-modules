import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IDolomiteStructs } from '../types/contracts/protocol/interfaces/IDolomiteMarginV2';
import { ONE_ETH_BI } from './no-deps-constants';
import WeiStruct = IDolomiteStructs.WeiStruct;

const _6_DECIMAL_DIFF = BigNumber.from('1000000000000');
const _8_DECIMAL_DIFF = BigNumber.from('10000000000');
const _9_DECIMAL_DIFF = BigNumber.from('1000000000');

export function parseOhm(value: string): BigNumber {
  return parseEther(value).div(_9_DECIMAL_DIFF);
}

export function parseUsdc(value: string): BigNumber {
  return parseEther(value).div(_6_DECIMAL_DIFF);
}

/**
 * @return A BigNumber with 36 decimals of precision
 */
export function parseUsdValue(value: string): BigNumber {
  return parseEther(value).mul(ONE_ETH_BI);
}

export function parseUsdt(value: string): BigNumber {
  return parseUsdc(value);
}

export function parseBtc(value: string): BigNumber {
  return parseEther(value).div(_8_DECIMAL_DIFF);
}

export function negateWei(a: WeiStruct): WeiStruct {
  return { sign: !a.sign, value: a.value };
}

export function addWei(a: WeiStruct, b: WeiStruct): WeiStruct {
  if (a.sign === b.sign) {
    // Both same sign: add values, keep sign
    return { sign: a.sign, value: BigNumber.from(a.value).add(b.value) };
  }

  // Different signs: subtract smaller from larger, take sign of larger
  if (BigNumber.from(a.value).gte(b.value)) {
    return { sign: a.sign, value: BigNumber.from(a.value).sub(b.value) };
  }

  return { sign: b.sign, value: BigNumber.from(b.value).sub(a.value) };
}

export function subWei(a: WeiStruct, b: WeiStruct): WeiStruct {
  return addWei(a, negateWei(b));
}

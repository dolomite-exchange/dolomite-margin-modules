import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const _6_DECIMAL_DIFF = BigNumber.from('1000000000000');
const _8_DECIMAL_DIFF = BigNumber.from('10000000000');
const _9_DECIMAL_DIFF = BigNumber.from('1000000000');

export function parseOhm(value: string): BigNumber {
  return parseEther(value).div(_9_DECIMAL_DIFF);
}

export function parseUsdc(value: string): BigNumber {
  return parseEther(value).div(_6_DECIMAL_DIFF);
}

export function parseUsdt(value: string): BigNumber {
  return parseUsdc(value);
}

export function parseBtc(value: string): BigNumber {
  return parseEther(value).div(_8_DECIMAL_DIFF);
}

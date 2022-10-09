// noinspection JSUnusedGlobalSymbols

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { assert } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { ethers, network } from 'hardhat';
import Web3 from 'web3';
import config from '../../hardhat.config';

let gasLogger: Record<string, BigNumber> = {};
let gasLoggerNumberOfCalls: Record<string, number> = {};

export async function resetFork(blockNumber: number) {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: config.networks?.hardhat?.forking?.url,
          blockNumber: blockNumber,
          ignoreUnknownTxType: config.networks?.hardhat?.forking?.ignoreUnknownTxType ?? false,
        },
      },
    ],
  });
}

/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @return The new snapshot ID of the chain
 */
export async function snapshot(): Promise<string> {
  const result = await network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
  return result as string;
}

/**
 * Note, snapshots can only be used once. Meaning, a new snapshot must be taken right after a reversion to ensure
 * a reversion can occur again in the future.
 *
 * @param snapshotId The snapshot point at which the chain will be reverted.
 * @return The new snapshot that was taken right after the reversion or the previous ID if a reversion did not occur.
 */
export async function revertToSnapshotAndCapture(snapshotId: string): Promise<string> {
  const id = await snapshot();

  if (id !== snapshotId) {
    await network.provider.request({
      method: 'evm_revert',
      params: [snapshotId],
    });
    return snapshot();
  } else {
    return id;
  }
}

export async function impersonate(targetAccount: string, giveEther: boolean = false): Promise<SignerWithAddress> {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [targetAccount],
  });
  if (giveEther) {
    await setEtherBalance(targetAccount);
  }
  return ethers.getSigner(targetAccount);
}

export async function impersonateAll(targetAccounts: string[], giveEther: boolean = false): Promise<SignerWithAddress[]> {
  const signers = [];
  for (let i = 0; i < targetAccounts.length; i++) {
    signers[i] = await impersonate(targetAccounts[i], giveEther);
  }
  return signers;
}

export async function gasLog(logTo: string, transactionPromise: Promise<ContractTransaction>) {
  let transaction = await transactionPromise;
  let gasUsed = (await ethers.provider.getTransactionReceipt(transaction.hash)).gasUsed;

  if (gasLogger[logTo] == undefined) {
    gasLogger[logTo] = gasUsed;
    gasLoggerNumberOfCalls[logTo] = 1;
  } else {
    const numberOfCalls = ++gasLoggerNumberOfCalls[logTo];
    gasLogger[logTo] = gasLogger[logTo].div(numberOfCalls).add(gasUsed.div(numberOfCalls));
  }
}

export async function printGasLog() {
  console.log('\tGas used:', JSON.stringify(gasLogger, undefined, '\n'));
}

export async function setEtherBalance(address: string, balance: BigNumberish = '1000000000000000000') {
  await network.provider.send('hardhat_setBalance', [
    address,
    `0x${ethers.BigNumber.from(balance).toBigInt().toString(16)}`,
  ]);
}

export async function advanceNBlock(n: number, secondsPerBlock: number = 1) {
  await ethers.provider.send('hardhat_mine', [`0x${n.toString(16)}`, `0x${secondsPerBlock.toString(16)}`]);
}

export async function waitDays(n: number) {
  await _waitTime((n * 3600 * 24) + 1);
}

export async function waitHours(n: number) {
  await _waitTime(n * 3600 + 1);
}

export async function waitTime(n: number) {
  await _waitTime(n);
}

export async function getLatestTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp
}

export async function getLatestBlockNumber(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block.number
}

export async function sendEther(from: string, to: string, value: BigNumberish): Promise<any> {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [from],
  });

  const signer = await ethers.getSigner(from);
  return signer.sendTransaction({
    from,
    to,
    value,
  });
}

export function assertBNEq(a: BigNumber, b: BigNumber) {
  let msg = a.toString() + ' != ' + b.toString();
  assert.equal(a.eq(b), true, msg);
}

export function assertApproxBNEq(a: BigNumber, b: BigNumber, c: BigNumber) {
  let _a = a.div(c);
  let _b = b.div(c);
  let msg = _a.toString() + ' != ' + _b.toString();
  assert.equal(_a.eq(_b), true, msg);
}

export function assertBNGt(a: BigNumber, b: BigNumber) {
  let msg = a.toString() + ' is not greater than ' + b.toString();
  assert.equal(a.gt(b), true, msg);
}

export function assertBNGte(a: BigNumber, b: BigNumber) {
  let msg = a.toString() + ' is not greater than ' + b.toString();
  assert.equal(a.gte(b), true, msg);
}

export function assertNEqBN(a: BigNumber, b: BigNumber) {
  assert.equal(a.eq(b), false);
}

export async function inBNfixed(a: BigNumber) {
  return a.toString();
}

export function calculateApr(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const base = ethers.BigNumber.from('1000000000000000000');
  const _newValue = ethers.BigNumber.from(newValue);
  const _oldValue = ethers.BigNumber.from(oldValue);
  return _newValue.mul(base).div(_oldValue).sub(base).mul(365 * 86400).div(durationDeltaSeconds);
}

export function calculateApy(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const _newValue = ethers.BigNumber.from(newValue);
  const _oldValue = ethers.BigNumber.from(oldValue);
  const one = ethers.BigNumber.from('1000000000000000000');
  return one.add(calculateApr(_newValue, _oldValue, durationDeltaSeconds).div(365))
    .pow(365)
    .mul(one)
    .div(one.pow(365))
    .sub(one);
}

export function formatNumber(n: BigNumberish): string {
  const _n = ethers.BigNumber.from(n);
  return Web3.utils.fromWei(_n.toString());
}

// ========================= Private Functions =========================

async function _waitTime(timeToAddSeconds: number) {
  const currentTimestamp = await ethers.provider.getBlock('latest');
  await ethers.provider.send('evm_setNextBlockTimestamp', [currentTimestamp.timestamp + timeToAddSeconds]);
  await ethers.provider.send('evm_mine', []);
}

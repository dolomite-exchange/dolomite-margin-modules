import { address } from '@dolomite-margin/dist/src';
import { assert, expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ERC20, ERC20__factory } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { valueStructToBigNumber } from '../../src/utils/dolomite-utils';
import { CoreProtocol } from './setup';

export function assertEqBn(a: BigNumber, b: BigNumber) {
  const msg = `${a.toString()} != ${b.toString()}`;
  assert.equal(a.eq(b), true, msg);
}

export function assertApproxEqBn(a: BigNumber, b: BigNumber, divisor: BigNumber) {
  const aBN = a.div(divisor);
  const bBN = b.div(divisor);
  const msg = `${aBN.toString()} != ${bBN.toString()}`;
  assert.equal(aBN.eq(bBN), true, msg);
}

export function assertGtBn(a: BigNumber, b: BigNumber) {
  const msg = `${a.toString()} is not greater than ${b.toString()}`;
  assert.equal(a.gt(b), true, msg);
}

export function assertGteBn(a: BigNumber, b: BigNumber) {
  const msg = `${a.toString()} is not greater than ${b.toString()}`;
  assert.equal(a.gte(b), true, msg);
}

export function assertNotEqualBn(a: BigNumber, b: BigNumber) {
  assert.equal(a.eq(b), false);
}

export async function expectThrow(call: Promise<any>, reason?: string) {
  if (reason) {
    await expect(call).to.be.revertedWith(reason);
  } else {
    await expect(call).to.be.reverted;
  }
}

export async function expectNoThrow(call: Promise<any>) {
  await expect(call).not.to.be.reverted;
}

// ========================= Balance Assertions =========================

export async function expectBalance(
  coreProtocol: CoreProtocol,
  accountStruct: AccountStruct,
  marketId: BigNumberish,
  expectedBalance: BigNumberish,
) {
  const balance = await coreProtocol.dolomiteMargin.getAccountWei(accountStruct, marketId);
  expect(valueStructToBigNumber(balance))
    .to
    .eq(BigNumber.from(expectedBalance));
}

export async function expectBalanceIsGreaterThan(
  coreProtocol: CoreProtocol,
  accountStruct: AccountStruct,
  marketId: BigNumberish,
  expectedBalance: BigNumberish,
  marginOfErrorBps: BigNumberish,
) {
  assertHardhatInvariant(BigNumber.from(marginOfErrorBps).lte(10000), 'Margin of error must be less than 10000 bps');

  const expectedBalanceWithMarginOfError = BigNumber.from(expectedBalance)
    .sub(BigNumber.from(expectedBalance).mul(marginOfErrorBps).div('10000'));
  const balance = await coreProtocol.dolomiteMargin.getAccountWei(accountStruct, marketId);
  expect(valueStructToBigNumber(balance))
    .to
    .gte(expectedBalanceWithMarginOfError);
}

const ONE_CENT = BigNumber.from('10000000000000000000000000000000000'); // $1 eq 1e36. Take off 2 decimals

export async function expectWalletBalanceOrDustyIfZero(
  coreProtocol: CoreProtocol,
  wallet: address,
  token: address,
  expectedBalance: BigNumberish,
) {
  const contract = await new BaseContract(token, ERC20__factory.createInterface()) as ERC20;
  const balance = await contract.connect(coreProtocol.hhUser1).balanceOf(wallet);
  if (!balance.eq(expectedBalance) && BigNumber.from(expectedBalance).eq('0')) {
    // check the amount is dusty then (< $0.01)
    const price = await coreProtocol.dolomiteMargin.getMarketPrice(
      await coreProtocol.dolomiteMargin.getMarketIdByTokenAddress(token),
    );
    const monetaryValue = price.value.mul(balance);
    expect(monetaryValue).to.be.lt(ONE_CENT);
  } else {
    expect(balance).to.eq(BigNumber.from(expectedBalance));
  }
}

export async function expectEvent(
  contract: BaseContract,
  contractTransaction: ContractTransaction,
  eventName: string,
  args: object,
) {
  const argsArray = Object.values(args);
  if (argsArray.length > 0) {
    await expect(contractTransaction).to.emit(contract, eventName).withArgs(...argsArray);
  } else {
    await expect(contractTransaction).to.emit(contract, eventName);
  }
}

import { address, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish, CallOverrides, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ERC20__factory } from '../../src/types';
import { AccountInfoStruct } from '../../src/utils';
import { AccountStruct } from '../../src/utils/constants';
import { valueStructToBigNumber } from '../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { CoreProtocolType } from './setup';

export async function expectThrowWithMatchingReason(call: Promise<any>, reason: RegExp) {
  if (reason) {
    await expect(call).to.be.revertedWith(reason);
  } else {
    await expect(call).to.be.reverted;
  }
}

export async function expectThrow(call: Promise<any>, reason?: string) {
  if (reason) {
    await expect(call).to.be.revertedWith(reason);
  } else {
    await expect(call).to.be.reverted;
  }
}

export async function expectThrowBalanceFlagError(
  call: Promise<any>,
  accountOwner: { address: address },
  accountNumber: BigNumberish,
  marketId: BigNumberish,
) {
  const ownerString = accountOwner.address.toLowerCase();
  const numberString = accountNumber.toString();
  const marketString = marketId.toString();
  await expectThrow(
    call,
    `AccountBalanceLib: account cannot go negative <${ownerString}, ${numberString}, ${marketString}>`,
  );
}

export async function expectNoThrow(call: Promise<any>) {
  await expect(call).not.to.be.reverted;
}

// ========================= Balance Assertions =========================

export async function expectProtocolBalanceIsGreaterThan<T extends Network>(
  coreProtocol: CoreProtocolType<T>,
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

export async function expectProtocolBalanceIsLessThan<T extends Network>(
  coreProtocol: CoreProtocolType<T>,
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
    .lte(expectedBalanceWithMarginOfError);
}

const ONE_CENT: BigNumber = BigNumber.from('10000000000000000000000000000000000'); // $1 eq 1e36. Take off 2 decimals

export async function expectWalletBalanceOrDustyIfZero<T extends Network>(
  coreProtocol: CoreProtocolType<T>,
  wallet: address,
  token: address,
  expectedBalance: BigNumberish,
  balanceBefore?: BigNumber,
) {
  const tokenContract = await ERC20__factory.connect(token, coreProtocol.hhUser1);
  let balance = await tokenContract.balanceOf(wallet);
  balance = balanceBefore ? balance.sub(balanceBefore) : balance;

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
): Promise<void> {
  const argsArray = Object.values(args);
  if (argsArray.length > 0) {
    return expect(contractTransaction).to.emit(contract, eventName).withArgs(...argsArray);
  }
  return expect(contractTransaction).to.emit(contract, eventName);
}

export async function expectNotEvent(
  contract: BaseContract,
  contractTransaction: ContractTransaction,
  eventName: string,
): Promise<void> {
  return expect(contractTransaction).to.not.emit(contract, eventName);
}

export async function expectProtocolBalance<T extends Network>(
  core: CoreProtocolType<T>,
  accountOwner: { address: address } | address,
  accountNumber: BigNumberish,
  marketId: BigNumberish,
  amountWei: BigNumberish,
) {
  const account = {
    owner: typeof accountOwner === 'object' ? accountOwner.address : accountOwner,
    number: accountNumber,
  };
  const rawBalanceWei = await core.dolomiteMargin.getAccountWei(account, marketId);
  const balanceWei = rawBalanceWei.sign ? rawBalanceWei.value : rawBalanceWei.value.mul(-1);
  expect(balanceWei)
    .eq(
      amountWei,
      `Expected ${balanceWei.toString()} to equal ${amountWei.toString()} for ${accountOwner} ${accountNumber} ${marketId}`,
    );
}

export async function expectProtocolParBalance<T extends Network>(
  core: CoreProtocolType<T>,
  accountOwner: { address: address } | address,
  accountNumber: BigNumberish,
  marketId: BigNumberish,
  amountPar: BigNumberish,
) {
  const account = {
    owner: typeof accountOwner === 'object' ? accountOwner.address : accountOwner,
    number: accountNumber,
  };
  const rawBalancePar = await core.dolomiteMargin.getAccountPar(account, marketId);
  const balancePar = rawBalancePar.sign ? rawBalancePar.value : rawBalancePar.value.mul(-1);
  expect(balancePar)
    .eq(
      amountPar,
      `Expected ${balancePar.toString()} to equal ${amountPar.toString()} for ${accountOwner} ${accountNumber} ${marketId}`,
    );
}

export async function expectProtocolBalanceDustyOrZero<T extends Network>(
  core: CoreProtocolType<T>,
  accountOwner: { address: address } | address,
  accountNumber: BigNumberish,
  marketId: BigNumberish,
  maxDustyValueUsd: BigNumber = ONE_CENT,
) {
  const account = {
    owner: typeof accountOwner === 'object' ? accountOwner.address : accountOwner,
    number: accountNumber,
  };
  const rawBalanceWei = await core.dolomiteMargin.getAccountWei(account, marketId);
  const balanceWei = rawBalanceWei.sign ? rawBalanceWei.value : rawBalanceWei.value.mul(-1);
  const price = await core.dolomiteMargin.getMarketPrice(marketId);
  expect(balanceWei.mul(price.value)).to.be.lt(maxDustyValueUsd);
}

export async function expectEthBalance(
  accountOwner: { address: address } | address,
  amount: BigNumberish,
) {
  const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
  const balance = await ethers.provider.getBalance(owner);
  expect(balance)
    .eq(
      amount,
      `Expected ${balance.toString()} to equal ${amount.toString()} for ${accountOwner} ${owner}`,
    );
}

export async function expectWalletBalance(
  accountOwner: { address: address } | address,
  token: { balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>, address: address },
  amount: BigNumberish,
) {
  const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
  const balance = await token.balanceOf(owner);
  expect(balance)
    .eq(
      amount,
      `Expected ${balance.toString()} to equal ${amount.toString()} for ${accountOwner} ${owner} ${token.address}`,
    );
}

export async function expectWalletBalanceIsGreaterThan(
  accountOwner: { address: address } | address,
  token: { balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>, address: address },
  amount: BigNumberish,
) {
  const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
  const balance = await token.balanceOf(owner);
  expect(balance)
    .to
    .be
    .gt(
      amount,
      `Expected ${balance.toString()} to be gt ${amount.toString()} for ${accountOwner} ${owner} ${token.address}`,
    );
}

export async function expectWalletBalanceIsBetween(
  accountOwner: { address: address } | address,
  token: { balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>, address: address },
  amountLowerEnd: BigNumberish,
  amountUpperEnd: BigNumberish,
) {
  const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
  const balance = await token.balanceOf(owner);
  expect(balance)
    .to
    .be
    .gt(
      amountLowerEnd,
      `Expected ${balance.toString()} to be gt ${amountLowerEnd.toString()} for ${owner} ${token.address}`,
    );
  expect(balance)
    .to
    .be
    .lt(
      amountUpperEnd,
      `Expected ${balance.toString()} to be lt ${amountUpperEnd.toString()} for ${owner} ${token.address}`,
    );
}

export async function expectVaultBalanceToMatchAccountBalances<T extends Network>(
  core: CoreProtocolType<T>,
  vault: { underlyingBalanceOf(overrides?: CallOverrides): Promise<BigNumber> },
  accounts: AccountInfoStruct[],
  marketId: BigNumberish,
) {
  let totalBalance = ZERO_BI;
  for (let i = 0; i < accounts.length; i++) {
    totalBalance = totalBalance.add((await core.dolomiteMargin.getAccountWei(accounts[i], marketId)).value);
  }
  expect(await vault.underlyingBalanceOf()).eq(totalBalance);
}

export async function expectWalletAllowance(
  accountOwner: { address: address } | address,
  accountSpender: { address: address } | address,
  token: { allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<BigNumber> },
  amount: BigNumberish,
) {
  const owner = typeof accountOwner === 'object' ? accountOwner.address : accountOwner;
  const spender = typeof accountSpender === 'object' ? accountSpender.address : accountSpender;
  expect(await token.allowance(owner, spender)).eq(amount);
}

export async function expectTotalSupply(
  token: { totalSupply(overrides?: CallOverrides): Promise<BigNumber> },
  amount: BigNumberish,
) {
  expect(await token.totalSupply()).eq(amount);
}

interface AssetAmount {
  sign: boolean;
  denomination: AmountDenomination;
  ref: AmountReference;
  value: BigNumberish;
}

export function expectAssetAmountToEq(
  found: AssetAmount,
  expected: AssetAmount,
) {
  expect(found.sign).eq(expected.sign);
  expect(found.denomination).eq(expected.denomination);
  expect(found.ref).eq(expected.ref);
  expect(found.value).eq(expected.value);
}

export function expectArrayEq(array1: any[], array2: any[]) {
  expect(array1.length).eq(array2.length);
  for (let i = 0; i < array1.length; i++) {
    expect(array1[i]).eq(array2[i]);
  }
}

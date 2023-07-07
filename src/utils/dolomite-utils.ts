import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber, BigNumberish, BytesLike } from 'ethers';
import { ethers } from 'hardhat';
import { CoreProtocol } from '../../test/utils/setup';
import {
  CustomTestToken,
  CustomTestToken__factory,
  CustomTestVaultToken,
  CustomTestVaultToken__factory,
} from '../types';
import { IDolomiteStructs } from '../types/contracts/protocol/interfaces/IDolomiteMargin';
import ActionArgsStruct = IDolomiteStructs.ActionArgsStruct;

/**
 * @return  The deployed contract
 */
export async function createContract<T extends BaseContract>(
  contractName: string,
  args: any[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(contractName);
  return await ContractFactory.deploy(...args) as T;
}

export async function createContractWithAbi<T extends BaseContract>(
  abi: readonly any[],
  bytecode: BytesLike,
  args: (number | string | BigNumberish | object)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(abi as any[], bytecode);
  return await ContractFactory.deploy(...args) as T;
}

export async function createTestToken(): Promise<CustomTestToken> {
  return createContractWithAbi<CustomTestToken>(
    CustomTestToken__factory.abi,
    CustomTestToken__factory.bytecode,
    ['Test Token', 'TEST', 18],
  );
}

export async function createTestVaultToken(asset: { address: string }): Promise<CustomTestVaultToken> {
  return createContractWithAbi<CustomTestVaultToken>(
    CustomTestVaultToken__factory.abi,
    CustomTestVaultToken__factory.bytecode,
    [asset.address, 'Test Vault Token', 'TEST', 18],
  );
}

export function createDepositAction(
  amount: BigNumberish,
  tokenId: BigNumberish,
  accountOwner: SignerWithAddress,
  fromAddress?: string,
): ActionArgsStruct {
  return {
    actionType: ActionType.Deposit, // deposit
    accountId: '0', // accounts[0]
    amount: {
      sign: true,
      denomination: AmountDenomination.Wei,
      ref: AmountReference.Delta,
      value: amount,
    },
    primaryMarketId: tokenId,
    secondaryMarketId: 0,
    otherAddress: fromAddress ?? accountOwner.address,
    otherAccountId: 0,
    data: '0x',
  };
}

export function createWithdrawAction(
  amount: BigNumberish,
  tokenId: BigNumberish,
  accountOwner: SignerWithAddress,
  toAddress?: string,
): ActionArgsStruct {
  return {
    actionType: ActionType.Withdraw,
    accountId: '0', // accounts[0]
    amount: {
      sign: false,
      denomination: AmountDenomination.Wei,
      ref: AmountReference.Delta,
      value: amount,
    },
    primaryMarketId: tokenId,
    secondaryMarketId: 0,
    otherAddress: toAddress ?? accountOwner.address,
    otherAccountId: 0,
    data: '0x',
  };
}

export async function depositIntoDolomiteMargin(
  core: CoreProtocol,
  accountOwner: SignerWithAddress,
  accountNumber: BigNumberish,
  tokenId: BigNumberish,
  amount: BigNumberish,
  fromAddress?: string,
): Promise<void> {
  await core.dolomiteMargin
    .connect(accountOwner)
    .operate(
      [{ owner: accountOwner.address, number: accountNumber }],
      [createDepositAction(amount, tokenId, accountOwner, fromAddress)],
    );
}

export async function withdrawFromDolomiteMargin(
  core: CoreProtocol,
  user: SignerWithAddress,
  accountId: BigNumberish,
  tokenId: BigNumberish,
  amount: BigNumberish,
  toAddress?: string,
): Promise<void> {
  await core.dolomiteMargin
    .connect(user)
    .operate(
      [{ owner: user.address, number: accountId }],
      [createWithdrawAction(amount, tokenId, user, toAddress)],
    );
}

export function valueStructToBigNumber(valueStruct: { sign: boolean; value: BigNumber }): BigNumber {
  return BigNumber.from(valueStruct.sign ? valueStruct.value : valueStruct.value.mul(-1));
}

export function getPartial(amount: BigNumber, numerator: BigNumber, denominator: BigNumber): BigNumber {
  return amount.mul(numerator).div(denominator);
}

export function getPartialRoundUp(target: BigNumber, numerator: BigNumber, denominator: BigNumber): BigNumber {
  return target.mul(numerator).sub(1).div(denominator).add(1);
}

export function getPartialRoundHalfUp(target: BigNumber, numerator: BigNumber, denominator: BigNumber): BigNumber {
  return target.mul(numerator).add(denominator.div(2)).div(denominator);
}

export function owedWeiToHeldWei(
  owedWei: BigNumber,
  owedPrice: BigNumber,
  heldPrice: BigNumber,
): BigNumber {
  return getPartial(owedWei, owedPrice, heldPrice);
}

export function heldWeiToOwedWei(
  heldWei: BigNumber,
  heldPrice: BigNumber,
  owedPrice: BigNumber,
): BigNumber {
  return getPartialRoundUp(heldWei, heldPrice, owedPrice);
}

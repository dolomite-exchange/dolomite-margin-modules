import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber, BigNumberish, BytesLike } from 'ethers';
import { ethers } from 'hardhat';
import { CustomTestToken, CustomTestToken__factory } from '../types';
import { DOLOMITE_MARGIN } from './constants';

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
  abi: any[],
  bytecode: BytesLike,
  args: (number | string | object)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(abi, bytecode);
  return await ContractFactory.deploy(...args) as T;
}

export async function createTestToken(): Promise<CustomTestToken> {
  return createContractWithAbi<CustomTestToken>(
    CustomTestToken__factory.abi,
    CustomTestToken__factory.bytecode,
    ['Test Token', 'TEST', 18],
  );
}
export async function depositIntoDolomiteMargin(
  accountOwner: SignerWithAddress,
  accountNumber: BigNumberish,
  tokenId: BigNumberish,
  amount: BigNumberish,
  fromAddress?: string,
): Promise<void> {
  await DOLOMITE_MARGIN
    .connect(accountOwner)
    .operate(
      [{ owner: accountOwner.address, number: accountNumber }],
    [
      {
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
      },
    ],
    );
}

export async function withdrawFromDolomiteMargin(
  user: SignerWithAddress,
  accountId: BigNumberish,
  tokenId: BigNumberish,
  amount: BigNumberish,
): Promise<void> {
  await DOLOMITE_MARGIN
    .connect(user)
    .operate(
      [{ owner: user.address, number: accountId }],
    [
      {
        actionType: '1', // deposit
        accountId: '0', // accounts[0]
        amount: {
          sign: false, // positive
          denomination: '0', // wei
          ref: '0', // value
          value: amount,
        },
        primaryMarketId: tokenId,
        secondaryMarketId: 0,
        otherAddress: user.address,
        otherAccountId: 0,
        data: '0x',
      },
    ],
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

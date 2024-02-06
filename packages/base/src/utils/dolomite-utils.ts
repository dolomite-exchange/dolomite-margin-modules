import { address } from '@dolomite-exchange/dolomite-margin';
import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber, BigNumberish, BytesLike } from 'ethers';
import hardhat, { ethers } from 'hardhat';
import { CoreProtocolType } from '../../test/utils/setup';
import {
  CustomTestToken,
  CustomTestToken__factory,
  CustomTestVaultToken,
  CustomTestVaultToken__factory,
} from '../types';
import { ActionArgsStruct } from './index';
import { MAX_UINT_256_BI, Network, networkToNetworkNameMap, NetworkType } from './no-deps-constants';

/**
 * @return  The deployed contract
 */
export async function createContractWithName<T extends BaseContract>(
  contractName: string,
  args: any[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(contractName);
  return await ContractFactory.deploy(...args) as T;
}

export async function createContractWithAbi<T extends BaseContract>(
  abi: readonly any[],
  bytecode: BytesLike,
  args: (number | string | BigNumberish | object | undefined)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(abi as any[], bytecode);
  return await ContractFactory.deploy(...args) as T;
}

export type LibraryName = string;

export async function createContractWithLibrary<T extends BaseContract>(
  name: string,
  libraries: Record<LibraryName, address>,
  args: (number | string | BigNumberish | boolean | object)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(name, { libraries });
  return await ContractFactory.deploy(...args) as T;
}

export async function createContractWithLibraryAndArtifact<T extends BaseContract>(
  artifact: any,
  libraries: Record<LibraryName, address>,
  args: (number | string | BigNumberish | object)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactoryFromArtifact(artifact as any, { libraries });
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
      ref: BigNumber.from(amount).eq(MAX_UINT_256_BI) ? AmountReference.Target : AmountReference.Delta,
      value: BigNumber.from(amount).eq(MAX_UINT_256_BI) ? '0' : amount,
    },
    primaryMarketId: tokenId,
    secondaryMarketId: 0,
    otherAddress: toAddress ?? accountOwner.address,
    otherAccountId: 0,
    data: '0x',
  };
}

export async function depositIntoDolomiteMargin<T extends NetworkType>(
  core: CoreProtocolType<T>,
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

export async function withdrawFromDolomiteMargin<T extends NetworkType>(
  core: CoreProtocolType<T>,
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

const NETWORK_TO_VALID_MAP: Record<NetworkType, boolean> = {
  [Network.ArbitrumOne]: true,
  [Network.Base]: true,
  [Network.PolygonZkEvm]: true,
};

export async function getAnyNetwork(): Promise<NetworkType> {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  if (!NETWORK_TO_VALID_MAP[network]) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  return network;
}

export async function getAndCheckSpecificNetwork<T extends NetworkType>(networkInvariant: T): Promise<T> {
  let foundNetwork: string;
  if (hardhat.network.name === 'hardhat') {
    if (!process.env.NETWORK) {
      return Promise.reject(new Error(`Invalid network, found: ${process.env.NETWORK}`));
    }
    foundNetwork = hardhat.userConfig.networks![process.env.NETWORK]!.chainId!.toString();
  } else {
    foundNetwork = (await ethers.provider.getNetwork()).chainId.toString();
  }

  if (foundNetwork !== networkInvariant) {
    const expectedName = networkToNetworkNameMap[networkInvariant];
    return Promise.reject(new Error(
      `This script can only be run on ${networkInvariant} (${expectedName}), but found: ${foundNetwork}`,
    ));
  }

  return networkInvariant;
}

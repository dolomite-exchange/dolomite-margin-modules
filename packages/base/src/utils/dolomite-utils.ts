import { address } from '@dolomite-exchange/dolomite-margin';
import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { BaseContract, BigNumber, BigNumberish, BytesLike, Signer } from 'ethers';
import fs, { readFileSync } from 'fs';
import hardhat, { artifacts, ethers } from 'hardhat';
import { Artifact } from 'hardhat/types';
import path, { join } from 'path';
import { CoreProtocolType } from '../../test/utils/setup';
import {
  CustomTestToken,
  CustomTestToken__factory,
  CustomTestVaultToken,
  CustomTestVaultToken__factory,
} from '../types';
import { ActionArgsStruct } from './index';
import { DolomiteNetwork, MAX_UINT_256_BI, NETWORK_TO_NETWORK_NAME_MAP } from './no-deps-constants';
import { SignerWithAddressWithSafety } from './SignerWithAddressWithSafety';

export async function createArtifactFromBaseWorkspaceIfNotExists(
  artifactName: string,
  subFolder: string,
): Promise<Artifact> {
  if (await artifacts.artifactExists(artifactName)) {
    // GUARD STATEMENT!
    return artifacts.readArtifact(artifactName);
  }

  const packagesPath = '../../../../packages';
  const children = fs
    .readdirSync(join(__dirname, packagesPath), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(packagesPath, d.name));

  const contractsFolders = ['contracts_coverage', 'contracts'];
  for (const contractFolder of contractsFolders) {
    for (const child of children) {
      const artifactPath = join(
        __dirname,
        child,
        `artifacts/${contractFolder}/${subFolder}/${artifactName}.sol/${artifactName}.json`,
      );
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
        await artifacts.saveArtifactAndDebugFile(artifact);
        return artifact;
      }
    }
  }

  return Promise.reject(new Error(`Could not find ${artifactName}`));
}

/**
 * @return  The deployed contract
 */
export async function createContractWithName<T extends BaseContract>(
  contractName: string,
  args: any[],
  options?: {},
  signer?: Signer,
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(contractName, signer);
  return (await ContractFactory.deploy(...(options ? [...args, options] : [...args]))) as T;
}

export async function createContractWithAbi<T extends BaseContract>(
  abi: readonly any[],
  bytecode: BytesLike,
  args: (number | string | BigNumberish | object | undefined)[],
  options?: {},
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(abi as any[], bytecode);
  return (await ContractFactory.deploy(...(options ? [...args, options] : [...args]))) as T;
}

export type LibraryName = string;

export async function createContractWithLibrary<T extends BaseContract>(
  name: string,
  libraries: Record<LibraryName, address>,
  args: (number | string | BigNumberish | boolean | object)[],
  options?: {},
  signer?: Signer,
): Promise<T> {
  const ContractFactory = await ethers.getContractFactory(name, { libraries, signer });
  return (await ContractFactory.deploy(...(options ? [...args, options] : [...args]))) as T;
}

export async function createContractWithLibraryAndArtifact<T extends BaseContract>(
  artifact: any,
  libraries: Record<LibraryName, address>,
  args: (number | string | BigNumberish | object)[],
): Promise<T> {
  const ContractFactory = await ethers.getContractFactoryFromArtifact(artifact as any, { libraries });
  return (await ContractFactory.deploy(...args)) as T;
}

export async function createTestToken(decimals: number = 18): Promise<CustomTestToken> {
  return createContractWithAbi<CustomTestToken>(CustomTestToken__factory.abi, CustomTestToken__factory.bytecode, [
    'Test Token',
    'TEST',
    decimals,
  ]);
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
  accountOwner: SignerWithAddressWithSafety,
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
  accountOwner: SignerWithAddressWithSafety,
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

export async function depositIntoDolomiteMargin<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  accountOwner: SignerWithAddressWithSafety,
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
      { gasLimit: 10_000_000 },
    );
}

export async function withdrawFromDolomiteMargin<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  accountOwner: SignerWithAddressWithSafety,
  accountNumber: BigNumberish,
  marketId: BigNumberish,
  amount: BigNumberish,
  toAddress?: string,
): Promise<void> {
  await core.dolomiteMargin
    .connect(accountOwner)
    .operate(
      [{ owner: accountOwner.address, number: accountNumber }],
      [createWithdrawAction(amount, marketId, accountOwner, toAddress)],
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

export function owedWeiToHeldWei(owedWei: BigNumber, owedPrice: BigNumber, heldPrice: BigNumber): BigNumber {
  return getPartial(owedWei, owedPrice, heldPrice);
}

export function heldWeiToOwedWei(heldWei: BigNumber, heldPrice: BigNumber, owedPrice: BigNumber): BigNumber {
  return getPartialRoundUp(heldWei, heldPrice, owedPrice);
}

export async function getAnyNetwork<T extends DolomiteNetwork>(): Promise<T> {
  let foundNetwork;
  if (hardhat.network.name === 'hardhat') {
    if (!process.env.NETWORK) {
      return Promise.reject(new Error(`Invalid network, found: ${process.env.NETWORK}`));
    }
    foundNetwork = hardhat.userConfig.networks![process.env.NETWORK]!.chainId!.toString();
  } else {
    foundNetwork = (await ethers.provider.getNetwork()).chainId.toString();
  }

  return foundNetwork as T;
}

export async function getAndCheckSpecificNetwork<T extends DolomiteNetwork>(networkInvariant: T): Promise<T> {
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
    const expectedName = NETWORK_TO_NETWORK_NAME_MAP[networkInvariant];
    return Promise.reject(
      new Error(`This script can only be run on ${networkInvariant} (${expectedName}), but found: ${foundNetwork}`),
    );
  }

  return networkInvariant;
}

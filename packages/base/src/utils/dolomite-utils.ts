import { address } from '@dolomite-exchange/dolomite-margin';
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
} from '../../src/types';
import { ActionArgsStruct } from './index';
import { MAX_UINT_256_BI, Network, networkToNetworkNameMap } from './no-deps-constants';

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
  args: (number | string | BigNumberish | object)[],
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

const NETWORK_TO_VALID_MAP: Record<Network, boolean> = {
  [Network.ArbitrumOne]: true,
  [Network.ArbitrumGoerli]: true,
};

export async function getAnyNetwork(): Promise<Network> {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  if (!NETWORK_TO_VALID_MAP[network]) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  return network;
}

export async function getAndCheckSpecificNetwork<T extends Network>(networkInvariant: T): Promise<T> {
  const network = (await ethers.provider.getNetwork()).chainId.toString();
  if (network !== networkInvariant) {
    return Promise.reject(new Error(
      `This script can only be run on ${networkInvariant} (${networkToNetworkNameMap[networkInvariant]})`,
    ));
  }

  return networkInvariant;
}

// async function addLibrariesToBytecode(
//   bytecode: BytesLike,
//   libraries: Record<LibraryName, address>,
// ): Promise<BytesLike> {
//   const neededLibraries: Array<{
//     sourceName: string;
//     libName: string;
//   }> = [];
//   for (const [sourceName, sourceLibraries] of Object.entries(
//     artifact.linkReferences
//   )) {
//     for (const libName of Object.keys(sourceLibraries)) {
//       neededLibraries.push({ sourceName, libName });
//     }
//   }

//   const linksToApply: Map<string, Link> = new Map();
//   for (const [linkedLibraryName, linkedLibraryAddress] of Object.entries(
//     libraries
//   )) {
//     let resolvedAddress: string;
//     resolvedAddress = linkedLibraryAddress;

//     if (!ethers.isAddress(resolvedAddress)) {
//       throw new HardhatEthersError(
//         `You tried to link the contract ${
//           artifact.contractName
//         } with the library ${linkedLibraryName}, but provided this invalid address: ${
//           resolvedAddress as any
//         }`
//       );
//     }

//     const matchingNeededLibraries = neededLibraries.filter((lib) => {
//       return (
//         lib.libName === linkedLibraryName ||
//         `${lib.sourceName}:${lib.libName}` === linkedLibraryName
//       );
//     });

//     if (matchingNeededLibraries.length === 0) {
//       let detailedMessage: string;
//       if (neededLibraries.length > 0) {
//         const libraryFQNames = neededLibraries
//           .map((lib) => `${lib.sourceName}:${lib.libName}`)
//           .map((x) => `* ${x}`)
//           .join("\n");
//         detailedMessage = `The libraries needed are:
// ${libraryFQNames}`;
//       } else {
//         detailedMessage = "This contract doesn't need linking any libraries.";
//       }
//       throw new HardhatEthersError(
//         `You tried to link the contract ${artifact.contractName} with ${linkedLibraryName}, which is not one of its libraries.
// ${detailedMessage}`
//       );
//     }

//     if (matchingNeededLibraries.length > 1) {
//       const matchingNeededLibrariesFQNs = matchingNeededLibraries
//         .map(({ sourceName, libName }) => `${sourceName}:${libName}`)
//         .map((x) => `* ${x}`)
//         .join("\n");
//       throw new HardhatEthersError(
//         `The library name ${linkedLibraryName} is ambiguous for the contract ${artifact.contractName}.
// It may resolve to one of the following libraries:
// ${matchingNeededLibrariesFQNs}

// To fix this, choose one of these fully qualified library names and replace where appropriate.`
//       );
//     }

//     const [neededLibrary] = matchingNeededLibraries;

//     const neededLibraryFQN = `${neededLibrary.sourceName}:${neededLibrary.libName}`;

//     // The only way for this library to be already mapped is
//     // for it to be given twice in the libraries user input:
//     // once as a library name and another as a fully qualified library name.
//     if (linksToApply.has(neededLibraryFQN)) {
//       throw new HardhatEthersError(
//         `The library names ${neededLibrary.libName} and ${neededLibraryFQN} refer to the same library and were given as two separate library links.
// Remove one of them and review your library links before proceeding.`
//       );
//     }

//     linksToApply.set(neededLibraryFQN, {
//       sourceName: neededLibrary.sourceName,
//       libraryName: neededLibrary.libName,
//       address: resolvedAddress,
//     });
//   }

//   if (linksToApply.size < neededLibraries.length) {
//     const missingLibraries = neededLibraries
//       .map((lib) => `${lib.sourceName}:${lib.libName}`)
//       .filter((libFQName) => !linksToApply.has(libFQName))
//       .map((x) => `* ${x}`)
//       .join("\n");

//     throw new HardhatEthersError(
//       `The contract ${artifact.contractName} is missing links for the following libraries:
// ${missingLibraries}

// Learn more about linking contracts at https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-ethers#library-linking
// `
//     );
//   }

//   return linkBytecode(artifact, [...linksToApply.values()]);
// }

// function linkBytecode(bytecode: BytesLike, libraries: Record<LibraryName, address>): BytesLike {
//   // TODO: measure performance impact
//   for (const { sourceName, libraryName, address } of libraries) {
//     const linkReferences = artifact.linkReferences[sourceName][libraryName];
//     for (const { start, length } of linkReferences) {
//       bytecode =
//         bytecode.substr(0, 2 + start * 2) +
//         address.substr(2) +
//         bytecode.substr(2 + (start + length) * 2);
//     }
//   }

//   return bytecode;
// }
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  ILiquidatorAssetRegistry,
  ILiquidatorAssetRegistryInterface,
} from "../../../../../@dolomite-exchange/modules-base/contracts/interfaces/ILiquidatorAssetRegistry";

const _abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    name: "getLiquidatorsForAsset",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_liquidator",
        type: "address",
      },
    ],
    name: "isAssetWhitelistedForLiquidation",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_liquidator",
        type: "address",
      },
    ],
    name: "ownerAddLiquidatorToAssetWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_liquidator",
        type: "address",
      },
    ],
    name: "ownerRemoveLiquidatorFromAssetWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class ILiquidatorAssetRegistry__factory {
  static readonly abi = _abi;
  static createInterface(): ILiquidatorAssetRegistryInterface {
    return new utils.Interface(_abi) as ILiquidatorAssetRegistryInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ILiquidatorAssetRegistry {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as ILiquidatorAssetRegistry;
  }
}
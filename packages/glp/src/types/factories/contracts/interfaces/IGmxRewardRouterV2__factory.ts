/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IGmxRewardRouterV2,
  IGmxRewardRouterV2Interface,
} from "../../../contracts/interfaces/IGmxRewardRouterV2";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_sender",
        type: "address",
      },
    ],
    name: "acceptTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "_shouldClaimGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeMultiplierPoints",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimWeth",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldConvertWethToEth",
        type: "bool",
      },
    ],
    name: "handleRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_sender",
        type: "address",
      },
    ],
    name: "pendingReceivers",
    outputs: [
      {
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
    ],
    name: "signalTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "stakeEsGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "stakeGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "unstakeEsGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "unstakeGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class IGmxRewardRouterV2__factory {
  static readonly abi = _abi;
  static createInterface(): IGmxRewardRouterV2Interface {
    return new utils.Interface(_abi) as IGmxRewardRouterV2Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IGmxRewardRouterV2 {
    return new Contract(address, _abi, signerOrProvider) as IGmxRewardRouterV2;
  }
}
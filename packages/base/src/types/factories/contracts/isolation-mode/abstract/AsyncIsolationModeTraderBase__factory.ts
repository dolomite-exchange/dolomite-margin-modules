/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  AsyncIsolationModeTraderBase,
  AsyncIsolationModeTraderBaseInterface,
} from "../../../../contracts/isolation-mode/abstract/AsyncIsolationModeTraderBase";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_bal",
        type: "uint256",
      },
    ],
    name: "OwnerWithdrawETH",
    type: "event",
  },
  {
    inputs: [],
    name: "DOLOMITE_MARGIN",
    outputs: [
      {
        internalType: "contract IDolomiteMargin",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "HANDLER_REGISTRY",
    outputs: [
      {
        internalType: "contract IHandlerRegistry",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WETH",
    outputs: [
      {
        internalType: "contract IWETH",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "callbackGasLimit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_handler",
        type: "address",
      },
    ],
    name: "isHandler",
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
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
    ],
    name: "ownerWithdrawETH",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;

export class AsyncIsolationModeTraderBase__factory {
  static readonly abi = _abi;
  static createInterface(): AsyncIsolationModeTraderBaseInterface {
    return new utils.Interface(_abi) as AsyncIsolationModeTraderBaseInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): AsyncIsolationModeTraderBase {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as AsyncIsolationModeTraderBase;
  }
}
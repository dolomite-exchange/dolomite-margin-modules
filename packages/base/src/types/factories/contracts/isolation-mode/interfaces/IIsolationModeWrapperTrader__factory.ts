/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IIsolationModeWrapperTrader,
  IIsolationModeWrapperTraderInterface,
} from "../../../../contracts/isolation-mode/interfaces/IIsolationModeWrapperTrader";

const _abi = [
  {
    inputs: [],
    name: "actionsLength",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_primaryAccountId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_otherAccountId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_primaryAccountOwner",
        type: "address",
      },
      {
        internalType: "address",
        name: "_otherAccountOwner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_outputMarket",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_inputMarket",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_minOutputAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_inputAmount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_orderData",
        type: "bytes",
      },
    ],
    name: "createActionsForWrapping",
    outputs: [
      {
        components: [
          {
            internalType: "enum IDolomiteStructs.ActionType",
            name: "actionType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "accountId",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "bool",
                name: "sign",
                type: "bool",
              },
              {
                internalType: "enum IDolomiteStructs.AssetDenomination",
                name: "denomination",
                type: "uint8",
              },
              {
                internalType: "enum IDolomiteStructs.AssetReference",
                name: "ref",
                type: "uint8",
              },
              {
                internalType: "uint256",
                name: "value",
                type: "uint256",
              },
            ],
            internalType: "struct IDolomiteStructs.AssetAmount",
            name: "amount",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "primaryMarketId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "secondaryMarketId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "otherAddress",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "otherAccountId",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        internalType: "struct IDolomiteStructs.ActionArgs[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_tradeOriginator",
        type: "address",
      },
      {
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "_outputToken",
        type: "address",
      },
      {
        internalType: "address",
        name: "_inputToken",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_inputAmount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_orderData",
        type: "bytes",
      },
    ],
    name: "exchange",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_inputToken",
        type: "address",
      },
      {
        internalType: "address",
        name: "_outputToken",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_desiredInputAmount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_orderData",
        type: "bytes",
      },
    ],
    name: "getExchangeCost",
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
        name: "_inputToken",
        type: "address",
      },
    ],
    name: "isValidInputToken",
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
    inputs: [],
    name: "token",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class IIsolationModeWrapperTrader__factory {
  static readonly abi = _abi;
  static createInterface(): IIsolationModeWrapperTraderInterface {
    return new utils.Interface(_abi) as IIsolationModeWrapperTraderInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IIsolationModeWrapperTrader {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IIsolationModeWrapperTrader;
  }
}
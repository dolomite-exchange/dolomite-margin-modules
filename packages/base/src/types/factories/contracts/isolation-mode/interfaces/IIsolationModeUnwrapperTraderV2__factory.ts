/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeUnwrapperTraderV2Interface,
} from "../../../../contracts/isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2";

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
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "primaryAccountId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "otherAccountId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "primaryAccountOwner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "primaryAccountNumber",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "otherAccountOwner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "otherAccountNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "outputMarket",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "inputMarket",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minOutputAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "inputAmount",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "orderData",
            type: "bytes",
          },
        ],
        internalType:
          "struct IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParams",
        name: "_params",
        type: "tuple",
      },
    ],
    name: "createActionsForUnwrapping",
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
        name: "_outputToken",
        type: "address",
      },
    ],
    name: "isValidOutputToken",
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

export class IIsolationModeUnwrapperTraderV2__factory {
  static readonly abi = _abi;
  static createInterface(): IIsolationModeUnwrapperTraderV2Interface {
    return new utils.Interface(
      _abi
    ) as IIsolationModeUnwrapperTraderV2Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IIsolationModeUnwrapperTraderV2 {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IIsolationModeUnwrapperTraderV2;
  }
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IGenericTraderProxyV1,
  IGenericTraderProxyV1Interface,
} from "../../../../../@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderProxyV1";

const _abi = [
  {
    inputs: [],
    name: "EXPIRY",
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
  {
    inputs: [
      {
        internalType: "address",
        name: "_eventEmitterRegistry",
        type: "address",
      },
    ],
    name: "ownerSetEventEmitterRegistry",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tradeAccountNumber",
        type: "uint256",
      },
      {
        internalType: "uint256[]",
        name: "_marketIdsPath",
        type: "uint256[]",
      },
      {
        internalType: "uint256",
        name: "_inputAmountWei",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_minOutputAmountWei",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "enum IGenericTraderBase.TraderType",
            name: "traderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "makerAccountIndex",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "trader",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "tradeData",
            type: "bytes",
          },
        ],
        internalType: "struct IGenericTraderBase.TraderParam[]",
        name: "_tradersPath",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "number",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.AccountInfo[]",
        name: "_makerAccounts",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "enum AccountBalanceLib.BalanceCheckFlag",
            name: "balanceCheckFlag",
            type: "uint8",
          },
          {
            internalType: "enum IGenericTraderProxyV1.EventEmissionType",
            name: "eventType",
            type: "uint8",
          },
        ],
        internalType: "struct IGenericTraderProxyV1.UserConfig",
        name: "_userConfig",
        type: "tuple",
      },
    ],
    name: "swapExactInputForOutput",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tradeAccountNumber",
        type: "uint256",
      },
      {
        internalType: "uint256[]",
        name: "_marketIdsPath",
        type: "uint256[]",
      },
      {
        internalType: "uint256",
        name: "_inputAmountWei",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_minOutputAmountWei",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "enum IGenericTraderBase.TraderType",
            name: "traderType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "makerAccountIndex",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "trader",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "tradeData",
            type: "bytes",
          },
        ],
        internalType: "struct IGenericTraderBase.TraderParam[]",
        name: "_tradersPath",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "number",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.AccountInfo[]",
        name: "_makerAccounts",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "fromAccountNumber",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "toAccountNumber",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "marketId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amountWei",
                type: "uint256",
              },
            ],
            internalType: "struct IGenericTraderProxyV1.TransferAmount[]",
            name: "transferAmounts",
            type: "tuple[]",
          },
        ],
        internalType: "struct IGenericTraderProxyV1.TransferCollateralParam",
        name: "_transferCollateralParams",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "marketId",
            type: "uint256",
          },
          {
            internalType: "uint32",
            name: "expiryTimeDelta",
            type: "uint32",
          },
        ],
        internalType: "struct IGenericTraderProxyV1.ExpiryParam",
        name: "_expiryParams",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "enum AccountBalanceLib.BalanceCheckFlag",
            name: "balanceCheckFlag",
            type: "uint8",
          },
          {
            internalType: "enum IGenericTraderProxyV1.EventEmissionType",
            name: "eventType",
            type: "uint8",
          },
        ],
        internalType: "struct IGenericTraderProxyV1.UserConfig",
        name: "_userConfig",
        type: "tuple",
      },
    ],
    name: "swapExactInputForOutputAndModifyPosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class IGenericTraderProxyV1__factory {
  static readonly abi = _abi;
  static createInterface(): IGenericTraderProxyV1Interface {
    return new utils.Interface(_abi) as IGenericTraderProxyV1Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IGenericTraderProxyV1 {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IGenericTraderProxyV1;
  }
}
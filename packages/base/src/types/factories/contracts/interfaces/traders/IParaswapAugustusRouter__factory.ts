/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IParaswapAugustusRouter,
  IParaswapAugustusRouterInterface,
} from "../../../../contracts/interfaces/traders/IParaswapAugustusRouter";

const _abi = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "fromToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "fromAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "toAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "expectedAmount",
            type: "uint256",
          },
          {
            internalType: "address payable",
            name: "beneficiary",
            type: "address",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "fromAmountPercent",
                type: "uint256",
              },
              {
                components: [
                  {
                    internalType: "address",
                    name: "to",
                    type: "address",
                  },
                  {
                    internalType: "uint256",
                    name: "totalNetworkFee",
                    type: "uint256",
                  },
                  {
                    components: [
                      {
                        internalType: "address payable",
                        name: "adapter",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "percent",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "networkFee",
                        type: "uint256",
                      },
                      {
                        components: [
                          {
                            internalType: "uint256",
                            name: "index",
                            type: "uint256",
                          },
                          {
                            internalType: "address",
                            name: "targetExchange",
                            type: "address",
                          },
                          {
                            internalType: "uint256",
                            name: "percent",
                            type: "uint256",
                          },
                          {
                            internalType: "bytes",
                            name: "payload",
                            type: "bytes",
                          },
                          {
                            internalType: "uint256",
                            name: "networkFee",
                            type: "uint256",
                          },
                        ],
                        internalType: "struct IParaswapAugustusRouter.Route[]",
                        name: "route",
                        type: "tuple[]",
                      },
                    ],
                    internalType: "struct IParaswapAugustusRouter.Adapter[]",
                    name: "adapters",
                    type: "tuple[]",
                  },
                ],
                internalType: "struct IParaswapAugustusRouter.Path[]",
                name: "path",
                type: "tuple[]",
              },
            ],
            internalType: "struct IParaswapAugustusRouter.MegaSwapPath[]",
            name: "path",
            type: "tuple[]",
          },
          {
            internalType: "address payable",
            name: "partner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "feePercent",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "permit",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "bytes16",
            name: "uuid",
            type: "bytes16",
          },
        ],
        internalType: "struct IParaswapAugustusRouter.MegaSwapSellData",
        name: "_data",
        type: "tuple",
      },
    ],
    name: "megaSwap",
    outputs: [
      {
        internalType: "uint256",
        name: "receivedAmount",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "fromToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "fromAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "toAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "expectedAmount",
            type: "uint256",
          },
          {
            internalType: "address payable",
            name: "beneficiary",
            type: "address",
          },
          {
            components: [
              {
                internalType: "address",
                name: "to",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "totalNetworkFee",
                type: "uint256",
              },
              {
                components: [
                  {
                    internalType: "address payable",
                    name: "adapter",
                    type: "address",
                  },
                  {
                    internalType: "uint256",
                    name: "percent",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "networkFee",
                    type: "uint256",
                  },
                  {
                    components: [
                      {
                        internalType: "uint256",
                        name: "index",
                        type: "uint256",
                      },
                      {
                        internalType: "address",
                        name: "targetExchange",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "percent",
                        type: "uint256",
                      },
                      {
                        internalType: "bytes",
                        name: "payload",
                        type: "bytes",
                      },
                      {
                        internalType: "uint256",
                        name: "networkFee",
                        type: "uint256",
                      },
                    ],
                    internalType: "struct IParaswapAugustusRouter.Route[]",
                    name: "route",
                    type: "tuple[]",
                  },
                ],
                internalType: "struct IParaswapAugustusRouter.Adapter[]",
                name: "adapters",
                type: "tuple[]",
              },
            ],
            internalType: "struct IParaswapAugustusRouter.Path[]",
            name: "path",
            type: "tuple[]",
          },
          {
            internalType: "address payable",
            name: "partner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "feePercent",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "permit",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "bytes16",
            name: "uuid",
            type: "bytes16",
          },
        ],
        internalType: "struct IParaswapAugustusRouter.MultiSwapSellData",
        name: "_data",
        type: "tuple",
      },
    ],
    name: "multiSwap",
    outputs: [
      {
        internalType: "uint256",
        name: "receivedAmount",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "fromToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "toToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "fromAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "toAmount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "expectedAmount",
            type: "uint256",
          },
          {
            internalType: "address[]",
            name: "callees",
            type: "address[]",
          },
          {
            internalType: "bytes",
            name: "exchangeData",
            type: "bytes",
          },
          {
            internalType: "uint256[]",
            name: "startIndexes",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "values",
            type: "uint256[]",
          },
          {
            internalType: "address payable",
            name: "beneficiary",
            type: "address",
          },
          {
            internalType: "address payable",
            name: "partner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "feePercent",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "permit",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "bytes16",
            name: "uuid",
            type: "bytes16",
          },
        ],
        internalType: "struct IParaswapAugustusRouter.SimpleSwapSellData",
        name: "data",
        type: "tuple",
      },
    ],
    name: "simpleSwap",
    outputs: [
      {
        internalType: "uint256",
        name: "receivedAmount",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export class IParaswapAugustusRouter__factory {
  static readonly abi = _abi;
  static createInterface(): IParaswapAugustusRouterInterface {
    return new utils.Interface(_abi) as IParaswapAugustusRouterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IParaswapAugustusRouter {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IParaswapAugustusRouter;
  }
}
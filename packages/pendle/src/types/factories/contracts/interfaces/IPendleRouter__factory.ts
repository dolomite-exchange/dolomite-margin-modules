/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IPendleRouter,
  IPendleRouterInterface,
} from "../../../contracts/interfaces/IPendleRouter";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "YT",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "netSyIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minPyOut",
        type: "uint256",
      },
    ],
    name: "mintPyFromSy",
    outputs: [
      {
        internalType: "uint256",
        name: "netPyOut",
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
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "market",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "exactPtIn",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address",
            name: "tokenOut",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "minTokenOut",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "tokenRedeemSy",
            type: "address",
          },
          {
            internalType: "address",
            name: "bulk",
            type: "address",
          },
          {
            internalType: "address",
            name: "pendleSwap",
            type: "address",
          },
          {
            components: [
              {
                internalType: "enum IPendleRouter.SwapType",
                name: "swapType",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "extRouter",
                type: "address",
              },
              {
                internalType: "bytes",
                name: "extCalldata",
                type: "bytes",
              },
              {
                internalType: "bool",
                name: "needScale",
                type: "bool",
              },
            ],
            internalType: "struct IPendleRouter.SwapData",
            name: "swapData",
            type: "tuple",
          },
        ],
        internalType: "struct IPendleRouter.TokenOutput",
        name: "output",
        type: "tuple",
      },
    ],
    name: "swapExactPtForToken",
    outputs: [
      {
        internalType: "uint256",
        name: "netTokenOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "netSyFee",
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
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "market",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "minPtOut",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "guessMin",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "guessMax",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "guessOffchain",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxIteration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "eps",
            type: "uint256",
          },
        ],
        internalType: "struct IPendleRouter.ApproxParams",
        name: "guessPtOut",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "address",
            name: "tokenIn",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "netTokenIn",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "tokenMintSy",
            type: "address",
          },
          {
            internalType: "address",
            name: "bulk",
            type: "address",
          },
          {
            internalType: "address",
            name: "pendleSwap",
            type: "address",
          },
          {
            components: [
              {
                internalType: "enum IPendleRouter.SwapType",
                name: "swapType",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "extRouter",
                type: "address",
              },
              {
                internalType: "bytes",
                name: "extCalldata",
                type: "bytes",
              },
              {
                internalType: "bool",
                name: "needScale",
                type: "bool",
              },
            ],
            internalType: "struct IPendleRouter.SwapData",
            name: "swapData",
            type: "tuple",
          },
        ],
        internalType: "struct IPendleRouter.TokenInput",
        name: "input",
        type: "tuple",
      },
    ],
    name: "swapExactTokenForPt",
    outputs: [
      {
        internalType: "uint256",
        name: "netPtOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "netSyFee",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "market",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "minYtOut",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "guessMin",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "guessMax",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "guessOffchain",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxIteration",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "eps",
            type: "uint256",
          },
        ],
        internalType: "struct IPendleRouter.ApproxParams",
        name: "guessYtOut",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "address",
            name: "tokenIn",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "netTokenIn",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "tokenMintSy",
            type: "address",
          },
          {
            internalType: "address",
            name: "bulk",
            type: "address",
          },
          {
            internalType: "address",
            name: "pendleSwap",
            type: "address",
          },
          {
            components: [
              {
                internalType: "enum IPendleRouter.SwapType",
                name: "swapType",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "extRouter",
                type: "address",
              },
              {
                internalType: "bytes",
                name: "extCalldata",
                type: "bytes",
              },
              {
                internalType: "bool",
                name: "needScale",
                type: "bool",
              },
            ],
            internalType: "struct IPendleRouter.SwapData",
            name: "swapData",
            type: "tuple",
          },
        ],
        internalType: "struct IPendleRouter.TokenInput",
        name: "input",
        type: "tuple",
      },
    ],
    name: "swapExactTokenForYt",
    outputs: [
      {
        internalType: "uint256",
        name: "netYtOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "netSyFee",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "market",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "netYtIn",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address",
            name: "tokenOut",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "minTokenOut",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "tokenRedeemSy",
            type: "address",
          },
          {
            internalType: "address",
            name: "bulk",
            type: "address",
          },
          {
            internalType: "address",
            name: "pendleSwap",
            type: "address",
          },
          {
            components: [
              {
                internalType: "enum IPendleRouter.SwapType",
                name: "swapType",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "extRouter",
                type: "address",
              },
              {
                internalType: "bytes",
                name: "extCalldata",
                type: "bytes",
              },
              {
                internalType: "bool",
                name: "needScale",
                type: "bool",
              },
            ],
            internalType: "struct IPendleRouter.SwapData",
            name: "swapData",
            type: "tuple",
          },
        ],
        internalType: "struct IPendleRouter.TokenOutput",
        name: "output",
        type: "tuple",
      },
    ],
    name: "swapExactYtForToken",
    outputs: [
      {
        internalType: "uint256",
        name: "netTokenOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "netSyFee",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class IPendleRouter__factory {
  static readonly abi = _abi;
  static createInterface(): IPendleRouterInterface {
    return new utils.Interface(_abi) as IPendleRouterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IPendleRouter {
    return new Contract(address, _abi, signerOrProvider) as IPendleRouter;
  }
}
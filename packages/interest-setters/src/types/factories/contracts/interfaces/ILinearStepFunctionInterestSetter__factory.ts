/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  ILinearStepFunctionInterestSetter,
  ILinearStepFunctionInterestSetterInterface,
} from "../../../contracts/interfaces/ILinearStepFunctionInterestSetter";

const _abi = [
  {
    inputs: [],
    name: "LOWER_OPTIMAL_PERCENT",
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
    inputs: [],
    name: "OPTIMAL_UTILIZATION",
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
    inputs: [],
    name: "UPPER_OPTIMAL_PERCENT",
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
        name: "token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "borrowWei",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "supplyWei",
        type: "uint256",
      },
    ],
    name: "getInterestRate",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteInterestSetter.InterestRate",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "interestSetterType",
    outputs: [
      {
        internalType: "enum IDolomiteInterestSetter.InterestSetterType",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
] as const;

export class ILinearStepFunctionInterestSetter__factory {
  static readonly abi = _abi;
  static createInterface(): ILinearStepFunctionInterestSetterInterface {
    return new utils.Interface(
      _abi
    ) as ILinearStepFunctionInterestSetterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ILinearStepFunctionInterestSetter {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as ILinearStepFunctionInterestSetter;
  }
}
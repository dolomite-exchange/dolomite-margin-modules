/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IDolomiteInterestSetter,
  IDolomiteInterestSetterInterface,
} from "../../../../../../@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteInterestSetter";

const _abi = [
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

export class IDolomiteInterestSetter__factory {
  static readonly abi = _abi;
  static createInterface(): IDolomiteInterestSetterInterface {
    return new utils.Interface(_abi) as IDolomiteInterestSetterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IDolomiteInterestSetter {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IDolomiteInterestSetter;
  }
}
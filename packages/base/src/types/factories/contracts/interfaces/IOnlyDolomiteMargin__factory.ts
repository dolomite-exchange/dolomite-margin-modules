/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IOnlyDolomiteMargin,
  IOnlyDolomiteMarginInterface,
} from "../../../contracts/interfaces/IOnlyDolomiteMargin";

const _abi = [
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
] as const;

export class IOnlyDolomiteMargin__factory {
  static readonly abi = _abi;
  static createInterface(): IOnlyDolomiteMarginInterface {
    return new utils.Interface(_abi) as IOnlyDolomiteMarginInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IOnlyDolomiteMargin {
    return new Contract(address, _abi, signerOrProvider) as IOnlyDolomiteMargin;
  }
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IChainlinkRegistry,
  IChainlinkRegistryInterface,
} from "../../../contracts/interfaces/IChainlinkRegistry";

const _abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_upkeepId",
        type: "uint256",
      },
    ],
    name: "getForwarder",
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

export class IChainlinkRegistry__factory {
  static readonly abi = _abi;
  static createInterface(): IChainlinkRegistryInterface {
    return new utils.Interface(_abi) as IChainlinkRegistryInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IChainlinkRegistry {
    return new Contract(address, _abi, signerOrProvider) as IChainlinkRegistry;
  }
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  IGLPIsolationModeTokenVaultV2,
  IGLPIsolationModeTokenVaultV2Interface,
} from "../../../contracts/interfaces/IGLPIsolationModeTokenVaultV2";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_sender",
        type: "address",
      },
    ],
    name: "acceptFullAccountTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "gmxBalanceOf",
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
        internalType: "bool",
        name: "_shouldClaimGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeMultiplierPoints",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimWeth",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldDepositWethIntoDolomite",
        type: "bool",
      },
    ],
    name: "handleRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "_shouldClaimGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeEsGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldStakeMultiplierPoints",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldClaimWeth",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_shouldDepositWethIntoDolomite",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "_depositAccountNumberForWeth",
        type: "uint256",
      },
    ],
    name: "handleRewardsWithSpecificDepositAccountNumber",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "maxGmxUnstakeAmount",
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
    inputs: [],
    name: "registry",
    outputs: [
      {
        internalType: "contract IGmxRegistryV1",
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
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "stakeEsGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "stakeGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "sweepGmxTokensIntoGmxVault",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_gmxVault",
        type: "address",
      },
    ],
    name: "sync",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "unstakeEsGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "unstakeGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "_shouldStakeGmx",
        type: "bool",
      },
    ],
    name: "unvestGlp",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "_shouldStakeGmx",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "_addDepositIntoDolomite",
        type: "bool",
      },
    ],
    name: "unvestGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_esGmxAmount",
        type: "uint256",
      },
    ],
    name: "vestGlp",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_esGmxAmount",
        type: "uint256",
      },
    ],
    name: "vestGmx",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class IGLPIsolationModeTokenVaultV2__factory {
  static readonly abi = _abi;
  static createInterface(): IGLPIsolationModeTokenVaultV2Interface {
    return new utils.Interface(_abi) as IGLPIsolationModeTokenVaultV2Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IGLPIsolationModeTokenVaultV2 {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IGLPIsolationModeTokenVaultV2;
  }
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  TestDecimalLib,
  TestDecimalLibInterface,
} from "../../../contracts/test/TestDecimalLib";

const _abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_target",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.Decimal",
        name: "_decimal",
        type: "tuple",
      },
    ],
    name: "DecimalLibDiv",
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
        name: "_target",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.Decimal",
        name: "_decimal",
        type: "tuple",
      },
    ],
    name: "DecimalLibMul",
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
    inputs: [],
    name: "DecimalLibOne",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.Decimal",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.Decimal",
        name: "_decimal",
        type: "tuple",
      },
    ],
    name: "DecimalLibOnePlus",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.Decimal",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
] as const;

const _bytecode =
  "0x608060405234801561001057600080fd5b50610363806100206000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80630176fe20146100515780636862068b1461007a578063c4f7f39f146100b9578063cfc21fa6146100cc575b600080fd5b61006461005f36600461023f565b6100df565b604051610071919061027c565b60405180910390f35b6100ac6040805160208082018352600080835283518083018552528251908101909252670de0b6b3a764000082525090565b6040516100719190610288565b6100646100c736600461023f565b6100f4565b6100ac6100da366004610295565b610100565b60006100eb8383610118565b90505b92915050565b60006100eb8383610131565b6040805160208101909152600081526100ee8261014a565b60006100eb838360000151670de0b6b3a7640000610184565b60006100eb83670de0b6b3a76400008460000151610184565b6040805160208101909152600081526040518060200160405280670de0b6b3a7640000846000015161017c91906102cc565b905292915050565b60008161019184866102e4565b61019b9190610319565b949350505050565b80356100ee565b634e487b7160e01b600052604160045260246000fd5b601f19601f830116810181811067ffffffffffffffff821117156101e6576101e66101aa565b6040525050565b60006101f860405190565b905061020482826101c0565b919050565b60006020828403121561021e5761021e600080fd5b61022860206101ed565b9050600061023684846101a3565b82525092915050565b6000806040838503121561025557610255600080fd5b600061026185856101a3565b925050602061027285828601610209565b9150509250929050565b818152602081016100ee565b81518152602081016100ee565b6000602082840312156102aa576102aa600080fd5b600061019b8484610209565b634e487b7160e01b600052601160045260246000fd5b600082198211156102df576102df6102b6565b500190565b60008160001904831182151516156102fe576102fe6102b6565b500290565b634e487b7160e01b600052601260045260246000fd5b60008261032857610328610303565b50049056fea2646970667358221220722e9333fe5a6cb85f3ab212a358e1433a53150a42ec882c25c7aedab351507964736f6c63430008090033";

type TestDecimalLibConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: TestDecimalLibConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class TestDecimalLib__factory extends ContractFactory {
  constructor(...args: TestDecimalLibConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    overrides?: Overrides & { from?: string }
  ): Promise<TestDecimalLib> {
    return super.deploy(overrides || {}) as Promise<TestDecimalLib>;
  }
  override getDeployTransaction(
    overrides?: Overrides & { from?: string }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  override attach(address: string): TestDecimalLib {
    return super.attach(address) as TestDecimalLib;
  }
  override connect(signer: Signer): TestDecimalLib__factory {
    return super.connect(signer) as TestDecimalLib__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TestDecimalLibInterface {
    return new utils.Interface(_abi) as TestDecimalLibInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TestDecimalLib {
    return new Contract(address, _abi, signerOrProvider) as TestDecimalLib;
  }
}
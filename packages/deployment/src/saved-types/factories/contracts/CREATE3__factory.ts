/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type { CREATE3, CREATE3Interface } from "../../contracts/CREATE3";

const _abi = [
  {
    inputs: [],
    name: "DeploymentFailed",
    type: "error",
  },
] as const;

const _bytecode =
  "0x60566037600b82828239805160001a607314602a57634e487b7160e01b600052600060045260246000fd5b30600052607381538281f3fe73000000000000000000000000000000000000000030146080604052600080fdfea2646970667358221220cd70f77108b9ca5a6af3b3b9754dca6bfdb4ee2f7be311598f1327b1a415bf6864736f6c63430008090033";

type CREATE3ConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: CREATE3ConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class CREATE3__factory extends ContractFactory {
  constructor(...args: CREATE3ConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(overrides?: Overrides & { from?: string }): Promise<CREATE3> {
    return super.deploy(overrides || {}) as Promise<CREATE3>;
  }
  override getDeployTransaction(
    overrides?: Overrides & { from?: string }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  override attach(address: string): CREATE3 {
    return super.attach(address) as CREATE3;
  }
  override connect(signer: Signer): CREATE3__factory {
    return super.connect(signer) as CREATE3__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): CREATE3Interface {
    return new utils.Interface(_abi) as CREATE3Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): CREATE3 {
    return new Contract(address, _abi, signerOrProvider) as CREATE3;
  }
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  PayableOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "./common";

export interface CREATE3FactoryInterface extends utils.Interface {
  functions: {
    "deploy(bytes32,bytes)": FunctionFragment;
    "getDeployed(address,bytes32)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: "deploy" | "getDeployed"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "deploy",
    values: [BytesLike, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getDeployed",
    values: [string, BytesLike]
  ): string;

  decodeFunctionResult(functionFragment: "deploy", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getDeployed",
    data: BytesLike
  ): Result;

  events: {};
}

export interface CREATE3Factory extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: CREATE3FactoryInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    deploy(
      salt: BytesLike,
      creationCode: BytesLike,
      overrides?: PayableOverrides & { from?: string }
    ): Promise<ContractTransaction>;

    getDeployed(
      deployer: string,
      salt: BytesLike,
      overrides?: CallOverrides
    ): Promise<[string] & { deployed: string }>;
  };

  deploy(
    salt: BytesLike,
    creationCode: BytesLike,
    overrides?: PayableOverrides & { from?: string }
  ): Promise<ContractTransaction>;

  getDeployed(
    deployer: string,
    salt: BytesLike,
    overrides?: CallOverrides
  ): Promise<string>;

  callStatic: {
    deploy(
      salt: BytesLike,
      creationCode: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    getDeployed(
      deployer: string,
      salt: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;
  };

  filters: {};

  estimateGas: {
    deploy(
      salt: BytesLike,
      creationCode: BytesLike,
      overrides?: PayableOverrides & { from?: string }
    ): Promise<BigNumber>;

    getDeployed(
      deployer: string,
      salt: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    deploy(
      salt: BytesLike,
      creationCode: BytesLike,
      overrides?: PayableOverrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    getDeployed(
      deployer: string,
      salt: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}

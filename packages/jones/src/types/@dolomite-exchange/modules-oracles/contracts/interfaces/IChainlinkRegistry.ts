/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
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
} from "../../../../common";

export interface IChainlinkRegistryInterface extends utils.Interface {
  functions: {
    "getForwarder(uint256)": FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: "getForwarder"): FunctionFragment;

  encodeFunctionData(
    functionFragment: "getForwarder",
    values: [BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "getForwarder",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IChainlinkRegistry extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IChainlinkRegistryInterface;

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
    getForwarder(
      _upkeepId: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;
  };

  getForwarder(
    _upkeepId: BigNumberish,
    overrides?: CallOverrides
  ): Promise<string>;

  callStatic: {
    getForwarder(
      _upkeepId: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;
  };

  filters: {};

  estimateGas: {
    getForwarder(
      _upkeepId: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    getForwarder(
      _upkeepId: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "../../../../common";

export interface IBaseRegistryInterface extends utils.Interface {
  functions: {
    "dolomiteRegistry()": FunctionFragment;
    "ownerSetDolomiteRegistry(address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: "dolomiteRegistry" | "ownerSetDolomiteRegistry"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "dolomiteRegistry",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetDolomiteRegistry",
    values: [string]
  ): string;

  decodeFunctionResult(
    functionFragment: "dolomiteRegistry",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetDolomiteRegistry",
    data: BytesLike
  ): Result;

  events: {
    "DolomiteRegistrySet(address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "DolomiteRegistrySet"): EventFragment;
}

export interface DolomiteRegistrySetEventObject {
  _dolomiteRegistry: string;
}
export type DolomiteRegistrySetEvent = TypedEvent<
  [string],
  DolomiteRegistrySetEventObject
>;

export type DolomiteRegistrySetEventFilter =
  TypedEventFilter<DolomiteRegistrySetEvent>;

export interface IBaseRegistry extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IBaseRegistryInterface;

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
    dolomiteRegistry(overrides?: CallOverrides): Promise<[string]>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  dolomiteRegistry(overrides?: CallOverrides): Promise<string>;

  ownerSetDolomiteRegistry(
    _dolomiteRegistry: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    dolomiteRegistry(overrides?: CallOverrides): Promise<string>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "DolomiteRegistrySet(address)"(
      _dolomiteRegistry?: string | null
    ): DolomiteRegistrySetEventFilter;
    DolomiteRegistrySet(
      _dolomiteRegistry?: string | null
    ): DolomiteRegistrySetEventFilter;
  };

  estimateGas: {
    dolomiteRegistry(overrides?: CallOverrides): Promise<BigNumber>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    dolomiteRegistry(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}